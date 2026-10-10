"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { normalizeEmail, normalizePhone, parseMoney } from "@/lib/normalize";
import { PARTNER_KINDS, type PartnerKind } from "@/lib/partners";
import { createPartner, getPartner, markPaid } from "@/lib/services/partners";

const g = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const kindOf = (v: string): PartnerKind => (v in PARTNER_KINDS ? (v as PartnerKind) : "otro");
const pct = (v: string) => {
  const n = parseMoney(v);
  return n == null ? null : Math.min(100, Math.max(0, n));
};

export async function addPartner(formData: FormData) {
  await requireAdmin();
  const name = g(formData, "name");
  if (!name) redirect("/partners?error=Pon%20el%20nombre");
  const row = await createPartner({
    name, kind: kindOf(g(formData, "kind")), code: g(formData, "code"), contact_name: g(formData, "contact_name"),
    phone: g(formData, "phone"), email: g(formData, "email"), nif: g(formData, "nif"), share_pct: pct(g(formData, "share_pct")),
    active: formData.get("active") === "on",
  });
  redirect(`/partners/${row!.id}?nuevo=1`);
}

export async function updatePartner(id: string, formData: FormData) {
  await requireAdmin();
  const p = await getPartner(id);
  if (!p) return;
  const active = formData.get("active") === "on";
  await query(
    `UPDATE partners SET name = coalesce(nullif($2,''), name), kind = $3, contact_name = nullif($4,''), phone = nullif($5,''), email = nullif($6,''),
       nif = nullif($7,''), share_pct = coalesce($8, share_pct), active = $9,
       signed_at = CASE WHEN $9 THEN coalesce(nullif($10,'')::date, signed_at, current_date) ELSE signed_at END, notes = nullif($11,'')
     WHERE id = $1`,
    [id, g(formData, "name"), kindOf(g(formData, "kind")), g(formData, "contact_name"), normalizePhone(g(formData, "phone")) ?? g(formData, "phone"),
     normalizeEmail(g(formData, "email")) ?? "", g(formData, "nif"), pct(g(formData, "share_pct")), active, g(formData, "signed_at"), g(formData, "notes")],
  );
  revalidatePath(`/partners/${id}`);
  revalidatePath("/partners");
}

export async function payQuarter(id: string, period: string, formData: FormData) {
  await requireAdmin();
  const amount = parseMoney(g(formData, "amount"));
  if (amount == null) return;
  await markPaid(id, period, amount, g(formData, "note"));
  revalidatePath(`/partners/${id}`);
  revalidatePath("/partners");
}
