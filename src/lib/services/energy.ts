import "server-only";
import { query, queryOne } from "../db";
import { energyPriority, ENERGY_CONSENT_TEXT, type EnergyVertical } from "../energia";
import { matchProvince, normalizeEmail, normalizePhone } from "../normalize";
import { emitEvent } from "./events";

export type EnergySubmission = {
  vertical: EnergyVertical;
  full_name: string;
  phone: string;
  email?: string | null;
  province?: string | null;
  monthly_bill: number | null;
  property_type: string | null;
  owner: boolean | null;
  supplier?: string | null;
  customer_type: "hogar" | "negocio";
  consent: boolean;
  marketing_ok: boolean;
  channel: string;
  campaign?: string | null;
  utm?: Record<string, string>;
  notes?: string | null;
  raw?: unknown;
};

export type EnergyResult =
  | { ok: true; id: string; duplicate: boolean; priority: "A" | "B" | "C" }
  | { ok: false; error: string };

/** Alta de un lead de luz o placas. Si el mismo teléfono ya pidió lo mismo en los últimos 60 días, se actualiza en vez de duplicarlo. */
export async function submitEnergyLead(s: EnergySubmission): Promise<EnergyResult> {
  const full_name = s.full_name.trim().slice(0, 120);
  const phone = normalizePhone(s.phone);
  if (!full_name) return { ok: false, error: "Falta el nombre." };
  if (!phone || !/^\+34[6789]\d{8}$/.test(phone)) return { ok: false, error: "Revisa el teléfono: necesitamos un número español." };
  if (!s.consent) return { ok: false, error: "Necesitamos tu permiso para llamarte con el estudio." };
  const province = matchProvince(s.province) ?? (s.province?.trim() || null);
  const email = normalizeEmail(s.email);
  const pr = energyPriority(s);
  const consent_text = ENERGY_CONSENT_TEXT(s.vertical);
  const channel = (s.channel || "instagram").slice(0, 40).toLowerCase();
  const campaign = s.campaign?.slice(0, 120) || `${channel}-${s.vertical}`;
  const utm = JSON.stringify(s.utm ?? {});

  const prev = await queryOne<{ id: string }>(
    `SELECT id FROM energy_leads WHERE phone = $1 AND vertical = $2 AND status <> 'descartado' AND created_at > now() - interval '60 days'
      ORDER BY created_at DESC LIMIT 1`,
    [phone, s.vertical],
  );
  if (prev) {
    await query(
      `UPDATE energy_leads SET full_name = $2, email = coalesce($3, email), province = coalesce($4, province),
         monthly_bill = coalesce($5, monthly_bill), property_type = coalesce($6, property_type), owner = coalesce($7, owner),
         supplier = coalesce($8, supplier), priority = $9, priority_reasons = $10, updated_at = now()
       WHERE id = $1`,
      [prev.id, full_name, email, province, s.monthly_bill, s.property_type, s.owner, s.supplier || null, pr.tier, JSON.stringify(pr.reasons)],
    );
    return { ok: true, id: prev.id, duplicate: true, priority: pr.tier as "A" | "B" | "C" };
  }

  const row = await queryOne<{ id: string }>(
    `INSERT INTO energy_leads(vertical, full_name, phone, email, province, monthly_bill, property_type, owner, supplier, customer_type,
       priority, priority_reasons, channel, campaign, utm, consent_text, marketing_ok, notes, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
    [
      s.vertical, full_name, phone, email, province, s.monthly_bill, s.property_type, s.owner, s.supplier || null, s.customer_type,
      pr.tier, JSON.stringify(pr.reasons), channel, campaign, utm, consent_text, s.marketing_ok, s.notes || null, s.raw ? JSON.stringify(s.raw) : null,
    ],
  );
  await emitEvent("energia.nuevo", {
    id: row!.id, linea: s.vertical, nombre: full_name, telefono: phone, provincia: province, factura: s.monthly_bill, prioridad: pr.tier, canal: channel,
  });
  return { ok: true, id: row!.id, duplicate: false, priority: pr.tier as "A" | "B" | "C" };
}

export const ENERGY_STATUSES = ["nuevo", "no_contesta", "contactado", "estudio_enviado", "contratado", "descartado"] as const;

/** Cambia el estado y deja las fechas que usan los informes (primer contacto, conversión). */
export async function setEnergyStatus(id: string, status: string, extra: { commission?: number | null; lost_reason?: string | null } = {}) {
  if (!(ENERGY_STATUSES as readonly string[]).includes(status)) throw new Error("Estado no válido");
  const contacted = ["contactado", "estudio_enviado", "contratado"].includes(status);
  await query(
    `UPDATE energy_leads SET status = $2,
       attempts = attempts + CASE WHEN $2 IN ('no_contesta','contactado') THEN 1 ELSE 0 END,
       last_contact_at = CASE WHEN $2 IN ('no_contesta','contactado','estudio_enviado') THEN now() ELSE last_contact_at END,
       first_contact_at = CASE WHEN $3 THEN coalesce(first_contact_at, now()) ELSE first_contact_at END,
       converted_at = CASE WHEN $2 = 'contratado' THEN coalesce(converted_at, now()) ELSE NULL END,
       commission = CASE WHEN $2 = 'contratado' THEN coalesce($4, commission) ELSE commission END,
       lost_reason = CASE WHEN $2 = 'descartado' THEN coalesce($5, lost_reason) ELSE NULL END,
       updated_at = now()
     WHERE id = $1`,
    [id, status, contacted, extra.commission ?? null, extra.lost_reason || null],
  );
}
