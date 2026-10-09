"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

const pathFor = (kind: string, id: string) => (kind === "despacho" ? `/clientes/${id}` : `/clientes/l/${id}`);

/** Marca o desmarca un punto de la auditoría del mes (con nota opcional). */
export async function setAudit(kind: "despacho" | "linea", id: string, month: string, key: string, done: boolean, note?: string) {
  await requireUser();
  if (!/^\d{4}-\d{2}$/.test(month) || !/^[a-z0-9_]{1,40}$/.test(key)) return;
  await query(
    `INSERT INTO client_audits(client_kind, client_id, month, item_key, done, note) VALUES ($1, $2, $3, $4, $5, nullif($6, ''))
     ON CONFLICT (client_kind, client_id, month, item_key) DO UPDATE SET done = EXCLUDED.done,
       note = CASE WHEN $6::text IS NULL THEN client_audits.note ELSE nullif($6, '') END, updated_at = now()`,
    [kind, id, month, key, done, note == null ? null : note.trim().slice(0, 300)],
  );
  revalidatePath(pathFor(kind, id));
}
