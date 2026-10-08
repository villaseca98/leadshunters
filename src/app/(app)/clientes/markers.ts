"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { parseMoney } from "@/lib/normalize";

const pathFor = (kind: string, id: string) => (kind === "despacho" ? `/clientes/${id}` : `/clientes/l/${id}`);

async function touch(id: string) {
  const m = await queryOne<{ client_kind: string; client_id: string }>("SELECT client_kind, client_id FROM client_markers WHERE id = $1", [id]);
  if (m) {
    revalidatePath(pathFor(m.client_kind, m.client_id));
    revalidatePath("/clientes");
    revalidatePath("/facturacion");
  }
}

/** Suma o resta al marcador (botones + y −). */
export async function bumpMarker(id: string, delta: number) {
  await requireUser();
  await query("UPDATE client_markers SET value = value + $2, updated_at = now() WHERE id = $1", [id, delta]);
  await touch(id);
}

export async function setMarker(id: string, value: string) {
  await requireUser();
  await query("UPDATE client_markers SET value = $2, updated_at = now() WHERE id = $1", [id, parseMoney(value) ?? 0]);
  await touch(id);
}

export async function deleteMarker(id: string) {
  await requireUser();
  const m = await queryOne<{ client_kind: string; client_id: string; label: string }>("SELECT client_kind, client_id, label FROM client_markers WHERE id = $1", [id]);
  if (!m) return;
  // se quita también de los meses siguientes, para que no vuelva a aparecer
  await query("DELETE FROM client_markers WHERE client_kind = $1 AND client_id = $2 AND label = $3 AND (id = $4 OR value = 0)", [m.client_kind, m.client_id, m.label, id]);
  revalidatePath(pathFor(m.client_kind, m.client_id));
}

export async function addMarker(kind: "despacho" | "linea", clientId: string, month: string, formData: FormData) {
  await requireUser();
  const label = String(formData.get("label") ?? "").trim().slice(0, 60);
  if (!label || !/^\d{4}-\d{2}$/.test(month)) return;
  const unit = formData.get("unit") === "eur" ? "eur" : "num";
  await query(
    `INSERT INTO client_markers(client_kind, client_id, month, label, unit, billable, value, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7, (SELECT coalesce(max(position), 0) + 1 FROM client_markers WHERE client_kind = $1 AND client_id = $2 AND month = $3))
     ON CONFLICT (client_kind, client_id, month, label) DO NOTHING`,
    [kind, clientId, month, label, unit, unit === "eur" && formData.get("billable") === "on", parseMoney(formData.get("value")) ?? 0],
  );
  revalidatePath(pathFor(kind, clientId));
}
