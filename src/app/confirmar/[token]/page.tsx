// Página pública (sin login) para que el despacho confirme si la consulta se realizó.
// El enlace le llega por email desde n8n. Solo muestra el nombre del lead y la fecha.
import { queryOne } from "@/lib/db";
import { setConsultationStatus } from "@/lib/services/leads";
import { dateTime, nowMs } from "@/lib/format";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function confirm(token: string, status: "asistida" | "no_asistio") {
  "use server";
  const c = await queryOne<{ id: string; scheduled_at: string }>("SELECT id, scheduled_at FROM consultations WHERE confirm_token = $1", [token]);
  if (!c || new Date(c.scheduled_at) > new Date(Date.now() + 3600_000)) return;
  await setConsultationStatus(c.id, status, "despacho");
  revalidatePath(`/confirmar/${token}`);
}

export default async function Confirmar(props: PageProps<"/confirmar/[token]">) {
  const { token } = await props.params;
  const c = /^[0-9a-f]{32}$/.test(token)
    ? await queryOne<{ scheduled_at: string; status: string; full_name: string; cliente: string }>(
        `SELECT co.scheduled_at, co.status, l.full_name, c.name AS cliente FROM consultations co
           JOIN leads l ON l.id = co.lead_id JOIN clients c ON c.id = co.client_id WHERE co.confirm_token = $1`,
        [token],
      )
    : null;
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <div className="mb-4 text-sm font-bold text-slate-900">Leads<span className="text-indigo-600">Hunters</span></div>
        {!c ? (
          <p className="text-slate-600">Enlace no válido o caducado.</p>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-slate-900">¿Se realizó la consulta?</h1>
            <p className="mt-2 text-sm text-slate-600">
              {c.cliente} · <b>{c.full_name}</b> · {dateTime(c.scheduled_at)}
            </p>
            {c.status === "asistida" || c.status === "no_asistio" ? (
              <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${c.status === "asistida" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
                Registrado: {c.status === "asistida" ? "la consulta se realizó" : "la persona no se presentó"}. ¡Gracias!
              </p>
            ) : new Date(c.scheduled_at) > new Date(nowMs() + 3600_000) ? (
              <p className="mt-4 text-sm text-slate-500">Podrás confirmarlo cuando llegue la hora de la consulta.</p>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <form action={confirm.bind(null, token, "asistida")}>
                  <button className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-500">Sí, se realizó</button>
                </form>
                <form action={confirm.bind(null, token, "no_asistio")}>
                  <button className="w-full rounded-lg bg-white px-4 py-3 font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">No se presentó</button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
