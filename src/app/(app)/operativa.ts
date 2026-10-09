"use server";
// Operativa rápida desde las listas: cambiar estado en el sitio, arrastrar en el tablero y acciones en bloque.
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { LINE_STATUSES } from "@/lib/lineas";
import { setLineStatus } from "@/lib/services/lines";

const UUID = /^[0-9a-f-]{36}$/;
const CLIENT_STATUSES = ["activo", "pausado", "baja"];

function refresh(...paths: string[]) {
  for (const p of ["/", "/lineas", ...paths]) revalidatePath(p);
}

/** Estado de un lead de línea desde la lista, el tablero o Inicio. */
export async function quickLineStatus(id: string, status: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!UUID.test(id) || !(LINE_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Estado no válido" };
  await setLineStatus(id, status, { userId: user.id });
  refresh(`/lineas/${id}`);
  return { ok: true };
}

export type BulkAction =
  | { kind: "status"; status: string }
  | { kind: "priority"; priority: string }
  | { kind: "client"; clientId: string | null }
  | { kind: "llamar_ya" };

/** Acciones en bloque sobre varios leads de línea. Devuelve cuántos se han cambiado. */
export async function bulkLineLeads(ids: string[], action: BulkAction): Promise<{ ok: boolean; n: number; error?: string }> {
  const user = await requireUser();
  const list = ids.filter((id) => UUID.test(id)).slice(0, 500);
  if (!list.length) return { ok: false, n: 0, error: "No hay leads elegidos" };
  let n = 0;
  if (action.kind === "status") {
    if (!(LINE_STATUSES as readonly string[]).includes(action.status)) return { ok: false, n: 0, error: "Estado no válido" };
    for (const id of list) { await setLineStatus(id, action.status, { userId: user.id }); n++; }
  } else if (action.kind === "priority") {
    if (!["A", "B", "C"].includes(action.priority)) return { ok: false, n: 0, error: "Prioridad no válida" };
    n = (await query("UPDATE line_leads SET priority = $2, updated_at = now() WHERE id = ANY($1::uuid[]) RETURNING id", [list, action.priority])).length;
  } else if (action.kind === "client") {
    // solo se asigna a los leads de la misma línea que el cliente
    if (action.clientId && !UUID.test(action.clientId)) return { ok: false, n: 0, error: "Cliente no válido" };
    n = action.clientId
      ? (await query(
          `UPDATE line_leads ll SET client_id = lc.id, updated_at = now() FROM line_clients lc
            WHERE ll.id = ANY($1::uuid[]) AND lc.id = $2 AND lc.line_id = ll.line_id RETURNING ll.id`,
          [list, action.clientId],
        )).length
      : (await query("UPDATE line_leads SET client_id = NULL, updated_at = now() WHERE id = ANY($1::uuid[]) RETURNING id", [list])).length;
    if (action.clientId && n === 0) return { ok: false, n: 0, error: "Ese cliente es de otra línea" };
  } else if (action.kind === "llamar_ya") {
    n = (await query(
      "UPDATE line_leads SET next_call_at = now(), status = CASE WHEN status IN ('ganado','descartado') THEN 'no_contesta' ELSE status END, updated_at = now() WHERE id = ANY($1::uuid[]) RETURNING id",
      [list],
    )).length;
  }
  refresh("/clientes");
  return { ok: true, n };
}

/** Estado de un cliente (activo, pausado, baja) desde la lista de clientes. */
export async function quickClientStatus(kind: "despacho" | "linea", id: string, status: string): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  if (!UUID.test(id) || !CLIENT_STATUSES.includes(status)) return { ok: false, error: "Estado no válido" };
  await query(`UPDATE ${kind === "despacho" ? "clients" : "line_clients"} SET status = $2 WHERE id = $1`, [id, status]);
  refresh("/clientes", "/facturacion", kind === "despacho" ? `/clientes/${id}` : `/clientes/l/${id}`);
  return { ok: true };
}

/** Nota rápida en un lead de línea (se añade arriba con la fecha). */
export async function quickLineNote(id: string, text: string): Promise<{ ok: boolean }> {
  await requireUser();
  const t = text.trim().slice(0, 500);
  if (!UUID.test(id) || !t) return { ok: false };
  const stamp = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  await query("UPDATE line_leads SET notes = concat_ws(E'\\n', $2::text, notes), updated_at = now() WHERE id = $1", [id, `${stamp} · ${t}`]);
  refresh(`/lineas/${id}`);
  return { ok: true };
}
