// Página pública (sin login) para que el despacho confirme si la consulta se realizó.
// El enlace le llega por email desde n8n. Solo muestra el nombre del lead y la fecha.
import { queryOne } from "@/lib/db";
import { setConsultationStatus } from "@/lib/services/leads";
import { dateTime, nowMs } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { Logo } from "@/components/Sidebar";

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
  const done = c && (c.status === "asistida" || c.status === "no_asistio");
  return (
    <main className="flex min-h-dvh flex-col bg-paper px-5" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <Logo />
        {!c ? (
          <p className="mt-16 text-slate-600">Enlace no válido o caducado.</p>
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="mt-10 rounded-[1.75rem] bg-white p-6 ring-1 ring-slate-200">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{c.cliente}</div>
              <h1 className="font-display mt-2 text-2xl font-semibold leading-tight">¿Se realizó la consulta con {c.full_name.split(" ")[0]}?</h1>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3.5">
                <span className="grid size-11 place-items-center rounded-full bg-ink text-sm font-semibold text-white">{c.full_name.slice(0, 1)}</span>
                <div>
                  <div className="font-semibold">{c.full_name}</div>
                  <div className="text-sm text-slate-500">{dateTime(c.scheduled_at)}</div>
                </div>
              </div>
              {done ? (
                <p className={`mt-5 rounded-2xl px-4 py-3 text-sm font-medium ${c.status === "asistida" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
                  Registrado: {c.status === "asistida" ? "la consulta se realizó" : "la persona no se presentó"}. ¡Gracias!
                </p>
              ) : new Date(c.scheduled_at) > new Date(nowMs() + 3600_000) ? (
                <p className="mt-5 text-sm text-slate-500">Podrás confirmarlo cuando llegue la hora de la consulta.</p>
              ) : null}
            </div>
            {!done && new Date(c.scheduled_at) <= new Date(nowMs() + 3600_000) && (
              <div className="mt-auto grid gap-3 pt-8">
                <form action={confirm.bind(null, token, "asistida")}>
                  <button className="min-h-14 w-full rounded-full bg-emerald-600 text-base font-semibold text-white active:scale-[0.98]">Sí, se realizó</button>
                </form>
                <form action={confirm.bind(null, token, "no_asistio")}>
                  <button className="min-h-14 w-full rounded-full bg-white text-base font-semibold text-ink ring-1 ring-slate-300 active:scale-[0.98]">No se presentó</button>
                </form>
                <p className="text-center text-xs text-slate-500">Solo se facturan las consultas realizadas.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
