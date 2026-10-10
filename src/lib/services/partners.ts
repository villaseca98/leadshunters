import "server-only";
import { randomBytes } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";
import { codeFromName, normalizeCode, quarterOf, shareOf, type PartnerKind } from "@/lib/partners";

export type Partner = {
  id: string; code: string; name: string; kind: PartnerKind; contact_name: string | null; phone: string | null; email: string | null;
  nif: string | null; share_pct: number; portal_token: string; active: boolean; signed_at: string | null; notes: string | null; created_at: string;
};

export type PartnerRow = Partner & { leads: number; leads_90d: number; ganados: number; valor: number; comision: number; pagado: number; pendiente: number };

export type PartnerLead = {
  id: string; created_at: string; won_at: string | null; status: string; full_name: string; negocio: string | null;
  line_name: string; line_emoji: string; value: number | null; comision: number; trimestre: string | null;
};

const COLS = `p.id, p.code, p.name, p.kind, p.contact_name, p.phone, p.email, p.nif, p.share_pct::float AS share_pct, p.portal_token,
  p.active, p.signed_at::text AS signed_at, p.notes, p.created_at`;

const newToken = () => randomBytes(18).toString("base64url");

/** Todos los partners con sus números: leads traídos, ganados, comisión generada, pagado y pendiente. */
export async function listPartners(): Promise<PartnerRow[]> {
  const rows = await query<Partner & { leads: number; leads_90d: number; ganados: number; valor: number; pagado: number }>(
    `SELECT ${COLS},
       (SELECT count(*) FROM line_leads ll WHERE ll.partner_code = p.code)::int AS leads,
       (SELECT count(*) FROM line_leads ll WHERE ll.partner_code = p.code AND ll.created_at > now() - interval '90 days')::int AS leads_90d,
       (SELECT count(*) FROM line_leads ll WHERE ll.partner_code = p.code AND ll.status = 'ganado')::int AS ganados,
       coalesce((SELECT sum(ll.value) FROM line_leads ll WHERE ll.partner_code = p.code AND ll.status = 'ganado'), 0)::float AS valor,
       coalesce((SELECT sum(pp.amount) FROM partner_payouts pp WHERE pp.partner_id = p.id), 0)::float AS pagado
     FROM partners p ORDER BY p.active DESC, p.created_at DESC`,
  );
  return rows.map((r) => {
    const comision = shareOf(r.valor, r.share_pct);
    return { ...r, comision, pendiente: Math.max(0, Math.round((comision - r.pagado) * 100) / 100) };
  });
}

export async function partnerByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  return queryOne<Partner>(`SELECT ${COLS} FROM partners p WHERE p.portal_token = $1`, [token]);
}

export async function getPartner(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return queryOne<Partner>(`SELECT ${COLS} FROM partners p WHERE p.id = $1`, [id]);
}

/** Leads de un partner. Sin teléfono ni email: es lo que también ve él en su panel. */
export async function partnerLeads(p: Pick<Partner, "code" | "share_pct">): Promise<PartnerLead[]> {
  const rows = await query<Omit<PartnerLead, "comision" | "trimestre">>(
    `SELECT ll.id, ll.created_at, ll.won_at, ll.status, ll.full_name,
       coalesce(nullif(ll.data->>'business_type',''), nullif(ll.data->>'sector',''), nullif(ll.data->>'negocio','')) AS negocio,
       bl.name AS line_name, bl.emoji AS line_emoji, ll.value::float AS value
     FROM line_leads ll JOIN business_lines bl ON bl.id = ll.line_id
     WHERE ll.partner_code = $1 ORDER BY ll.created_at DESC LIMIT 500`,
    [p.code],
  );
  return rows.map((r) => ({
    ...r,
    comision: r.status === "ganado" ? shareOf(r.value, p.share_pct) : 0,
    trimestre: r.status === "ganado" && r.won_at ? quarterOf(r.won_at) : null,
  }));
}

/** Liquidación por trimestre de cierre: lo generado y lo ya pagado. */
export async function partnerQuarters(p: Pick<Partner, "id" | "code" | "share_pct">) {
  const leads = await partnerLeads(p);
  const paid = await query<{ period: string; amount: number; paid_at: string }>(
    "SELECT period, amount::float AS amount, paid_at FROM partner_payouts WHERE partner_id = $1", [p.id],
  );
  const map = new Map<string, { periodo: string; ganados: number; comision: number; pagado: number | null; pagado_at: string | null }>();
  for (const l of leads) {
    if (!l.trimestre) continue;
    const q = map.get(l.trimestre) ?? { periodo: l.trimestre, ganados: 0, comision: 0, pagado: null, pagado_at: null };
    q.ganados += 1;
    q.comision = Math.round((q.comision + l.comision) * 100) / 100;
    map.set(l.trimestre, q);
  }
  for (const x of paid) {
    const q = map.get(x.period) ?? { periodo: x.period, ganados: 0, comision: 0, pagado: null, pagado_at: null };
    q.pagado = x.amount;
    q.pagado_at = x.paid_at;
    map.set(x.period, q);
  }
  return [...map.values()].sort((a, b) => b.periodo.localeCompare(a.periodo));
}

async function freeCode(wanted: string) {
  let code = wanted;
  for (let i = 2; await queryOne("SELECT 1 FROM partners WHERE code = $1", [code]); i++) code = `${wanted.slice(0, 27)}-${i}`;
  return code;
}

export async function createPartner(input: {
  name: string; kind: PartnerKind; code?: string | null; contact_name?: string | null; phone?: string | null; email?: string | null;
  nif?: string | null; share_pct?: number | null; active?: boolean; notes?: string | null;
}) {
  const code = await freeCode(normalizeCode(input.code) ?? codeFromName(input.name));
  return queryOne<{ id: string; code: string }>(
    `INSERT INTO partners(code, name, kind, contact_name, phone, email, nif, share_pct, portal_token, active, signed_at, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CASE WHEN $10 THEN current_date END, $11) RETURNING id, code`,
    [code, input.name.trim().slice(0, 120), input.kind, input.contact_name || null, normalizePhone(input.phone) ?? (input.phone || null),
     normalizeEmail(input.email), input.nif || null, input.share_pct ?? 20, newToken(), !!input.active, input.notes || null],
  );
}

/** Solicitud de colaboración desde la web: queda como partner inactivo hasta firmar el acuerdo. Si ya existe (mismo email o teléfono), no duplica. */
export async function partnerApplication(a: { name: string; kind: PartnerKind; phone: string | null; email: string | null; notes: string }) {
  const phone = normalizePhone(a.phone);
  const email = normalizeEmail(a.email);
  if (!phone && !email) return { ok: false as const, error: "Necesitamos un teléfono o un email." };
  const prev = await queryOne<{ id: string }>(
    "SELECT id FROM partners WHERE ($1::text IS NOT NULL AND phone = $1) OR ($2::text IS NOT NULL AND email = $2) LIMIT 1", [phone, email],
  );
  if (prev) return { ok: true as const, id: prev.id, duplicate: true };
  const row = await createPartner({ name: a.name, kind: a.kind, phone, email, notes: `Solicitud web. ${a.notes}`.trim(), active: false });
  return { ok: true as const, id: row!.id, duplicate: false };
}

export async function markPaid(partnerId: string, period: string, amount: number, note?: string | null) {
  if (!/^\d{4}-T[1-4]$/.test(period) || !(amount >= 0)) return;
  await query(
    `INSERT INTO partner_payouts(partner_id, period, amount, note) VALUES ($1,$2,$3,$4)
     ON CONFLICT (partner_id, period) DO UPDATE SET amount = EXCLUDED.amount, note = EXCLUDED.note, paid_at = now()`,
    [partnerId, period, amount, note || null],
  );
}

/** Web pública de la marca donde están los enlaces de los partners (Recorta). */
export const brandUrl = () => process.env.RECORTA_URL?.replace(/\/$/, "") || "https://herramientas-ia.vercel.app";
