import "server-only";
import { query, queryOne } from "../db";
import { matchProvince, normalizeEmail, normalizePhone } from "../normalize";
import { answersToFields, CONSENT_TEXT, OPTIONAL_ANSWERS, FIRM_CONSENT_TEXT, evaluateTest, QUESTIONS, sourceFromUtm, type TestAnswers, type Verdict } from "../lsoTest";
import { contactInfo } from "../settings";
import { emitEvent } from "./events";
import { ingestLead } from "./leads";

export type TestSubmission = {
  answers: TestAnswers;
  full_name: string;
  phone: string;
  email?: string;
  province: string;
  consent: boolean;
  marketing_ok: boolean;
  utm: Record<string, string>;
  client_code?: string;
};

export async function clientByTestCode(code: string) {
  if (!/^[0-9a-f]{10}$/.test(code)) return null;
  return queryOne<{ id: string; name: string }>("SELECT id, name FROM clients WHERE test_code = $1 AND status <> 'baja'", [code]);
}

/** Despacho activo que atiende esa provincia: primero los que la tienen explícita, luego los de toda España; reparte al que menos leads lleva este mes. */
async function pickClient(province: string | null) {
  return queryOne<{ id: string; name: string }>(
    `SELECT c.id, c.name FROM clients c
      WHERE c.status = 'activo' AND (cardinality(c.provinces) = 0 OR $1 = ANY(c.provinces))
      ORDER BY (cardinality(c.provinces) = 0),
               (SELECT count(*) FROM leads l WHERE l.client_id = c.id AND l.created_at >= date_trunc('month', now()))
      LIMIT 1`,
    [province],
  );
}

export async function submitTest(s: TestSubmission): Promise<{ ok: true; verdict: Verdict } | { ok: false; error: string }> {
  for (const q of QUESTIONS) {
    const v = s.answers[q.id];
    if (v == null && OPTIONAL_ANSWERS.includes(q.id)) continue;
    if (!q.options.some((o) => o.value === v)) return { ok: false, error: "Faltan respuestas del test." };
  }
  const full_name = s.full_name.trim().slice(0, 120);
  const phone = normalizePhone(s.phone);
  const province = matchProvince(s.province);
  if (!full_name) return { ok: false, error: "Escribe tu nombre." };
  if (!phone || !/^\+34[6789]\d{8}$/.test(phone)) return { ok: false, error: "Revisa el teléfono: necesitamos un número español." };
  if (!province) return { ok: false, error: "Elige tu provincia." };
  if (!s.consent) return { ok: false, error: "Necesitamos tu permiso para que un abogado te llame." };

  const verdict = evaluateTest(s.answers);
  const firm = s.client_code ? await clientByTestCode(s.client_code) : null;
  if (s.client_code && !firm) return { ok: false, error: "Este enlace ya no está activo." };
  const { brand } = await contactInfo();
  const consent_text = firm ? FIRM_CONSENT_TEXT(firm.name) : CONSENT_TEXT(brand);
  const email = normalizeEmail(s.email);
  const utm = Object.fromEntries(Object.entries(s.utm).filter(([k]) => /^utm_|^fbclid$|^gclid$/.test(k)).map(([k, v]) => [k, String(v).slice(0, 200)]));

  const sub = await queryOne<{ id: string }>(
    `INSERT INTO test_submissions(full_name, phone, email, province, answers, verdict, consent_text, marketing_ok, utm)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [full_name, phone, email, province, JSON.stringify(s.answers), verdict.kind, consent_text, s.marketing_ok, JSON.stringify(utm)],
  );

  const client = firm ?? (await pickClient(province));
  if (client) {
    const lead = await ingestLead({
      client_id: client.id,
      source: sourceFromUtm(utm.utm_source),
      campaign: utm.utm_campaign ?? "test-web",
      ad_name: utm.utm_content ?? null,
      consent_text,
      consent_at: new Date().toISOString(),
      full_name,
      phone,
      email,
      province,
      ...answersToFields(s.answers),
      raw: { test: s.answers, resultado: verdict.kind, utm, marketing_ok: s.marketing_ok },
    });
    await query("UPDATE test_submissions SET client_id = $1, lead_id = $2 WHERE id = $3", [client.id, lead.id, sub!.id]);
  } else if (verdict.kind !== "no_apto") {
    const f = answersToFields(s.answers);
    const enProvincia = await queryOne<{ n: number }>(
      "SELECT count(*)::int AS n FROM test_submissions WHERE province = $1 AND client_id IS NULL AND verdict <> 'no_apto' AND created_at > now() - interval '30 days'",
      [province],
    );
    await emitEvent("test.sin_despacho", {
      nombre: full_name, telefono: phone, provincia: province, deuda: f.debt_amount, acreedores: f.creditors_count,
      resultado: verdict.kind, en_provincia_30d: enProvincia?.n ?? 1,
    });
  }
  return { ok: true, verdict };
}
