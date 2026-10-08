"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { energyPriority, parseBill, parseCustomerType, parseProperty, parseVertical } from "@/lib/energia";
import { matchProvince, normalizeEmail, normalizePhone, parseBool, parseMoney } from "@/lib/normalize";
import { setEnergyStatus, submitEnergyLead } from "@/lib/services/energy";

export async function changeEnergyStatus(id: string, formData: FormData) {
  await requireUser();
  const status = String(formData.get("status") ?? "");
  await setEnergyStatus(id, status, {
    commission: parseMoney(formData.get("commission")),
    lost_reason: String(formData.get("lost_reason") ?? "") || null,
  });
  revalidatePath(`/energia/${id}`);
  revalidatePath("/energia");
}

/** Datos confirmados al hablar con la persona: recalcula la prioridad. */
export async function updateEnergyLead(id: string, formData: FormData) {
  await requireUser();
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const vertical = g("vertical") === "placas" ? "placas" : "luz";
  const property_type = g("property_type") || null;
  const fields = {
    vertical, monthly_bill: parseBill(g("monthly_bill")), property_type, owner: g("owner") === "" ? null : parseBool(g("owner")),
    customer_type: parseCustomerType(g("customer_type"), property_type),
  } as const;
  const pr = energyPriority(fields);
  await query(
    `UPDATE energy_leads SET full_name = coalesce(nullif($2,''), full_name), phone = coalesce($3, phone), email = $4, province = $5,
       monthly_bill = $6, property_type = $7, owner = $8, customer_type = $9, supplier = nullif($10,''), notes = nullif($11,''),
       commission = $12, vertical = $13, priority = $14, priority_reasons = $15, updated_at = now()
     WHERE id = $1`,
    [
      id, g("full_name"), normalizePhone(g("phone")), normalizeEmail(g("email")), matchProvince(g("province")) ?? (g("province") || null),
      fields.monthly_bill, property_type, fields.owner, fields.customer_type, g("supplier"), g("notes"), parseMoney(g("commission")),
      vertical, pr.tier, JSON.stringify(pr.reasons),
    ],
  );
  revalidatePath(`/energia/${id}`);
}

export async function createEnergyLead(formData: FormData) {
  await requireUser();
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const vertical = parseVertical(g("vertical")) === "placas" ? "placas" : "luz";
  const property_type = parseProperty(g("property_type"));
  const r = await submitEnergyLead({
    vertical,
    full_name: g("full_name"),
    phone: g("phone"),
    email: g("email") || null,
    province: g("province") || null,
    monthly_bill: parseBill(g("monthly_bill")),
    property_type,
    owner: g("owner") === "" ? null : parseBool(g("owner")),
    supplier: g("supplier") || null,
    customer_type: parseCustomerType(g("customer_type"), property_type),
    consent: formData.get("consent") === "on",
    marketing_ok: false,
    channel: g("channel") || "manual",
    campaign: g("campaign") || null,
    notes: g("notes") || null,
  });
  if (!r.ok) redirect(`/energia/nuevo?error=${encodeURIComponent(r.error)}&linea=${vertical}`);
  redirect(`/energia/${r.id}`);
}

/** Derecho de supresión (RGPD): borra el lead del todo. */
export async function eraseEnergyLead(id: string) {
  await requireAdmin();
  await query("DELETE FROM energy_leads WHERE id = $1", [id]);
  redirect("/energia");
}
