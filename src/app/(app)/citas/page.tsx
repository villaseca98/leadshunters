import { query } from "@/lib/db";
import { CONSULTATION_STATUS } from "@/lib/labels";
import { dateTime, eur, telHref, toLocalInput } from "@/lib/format";
import { A, Empty, PageHeader, StatusBadge, Table, Td, btn, input } from "@/components/ui";
import { markConsultation, reschedule } from "./actions";

export default async function Citas(props: PageProps<"/citas">) {
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const client = str("cliente"), view = str("ver") || "pendientes";
  const clients = await query<{ id: string; name: string }>("SELECT id, name FROM clients ORDER BY name");
  const cond =
    view === "pendientes" ? "co.status = 'agendada'" :
    view === "por_confirmar" ? "co.status = 'agendada' AND co.scheduled_at < now()" :
    "true";
  const rows = await query<{
    id: string; scheduled_at: string; status: string; mode: string; confirmed_by: string | null; reminder_sent_at: string | null;
    lead_id: string; full_name: string; phone: string | null; debt_amount: number | null; cliente: string;
  }>(
    `SELECT co.id, co.scheduled_at, co.status, co.mode, co.confirmed_by, co.reminder_sent_at, l.id AS lead_id, l.full_name, l.phone, l.debt_amount, c.name AS cliente
       FROM consultations co JOIN leads l ON l.id = co.lead_id JOIN clients c ON c.id = co.client_id
      WHERE ${cond} AND ($1::uuid IS NULL OR co.client_id = $1)
      ORDER BY ${view === "todas" ? "co.scheduled_at DESC" : "co.scheduled_at"} LIMIT 200`,
    [client || null],
  );
  const tabs = [["pendientes", "Agendadas"], ["por_confirmar", "Pasadas sin confirmar"], ["todas", "Todas"]];

  return (
    <>
      <PageHeader title="Consultas" subtitle="Solo las consultas realizadas (asistidas) se facturan. El despacho también puede confirmarlas desde el enlace de su email." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map(([k, l]) => (
          <a key={k} href={`/citas?ver=${k}${client ? `&cliente=${client}` : ""}`} className={view === k ? btn.primary : btn.secondary}>{l}</a>
        ))}
        <form className="ml-auto flex gap-2">
          <input type="hidden" name="ver" value={view} />
          <select name="cliente" defaultValue={client} className={input}>
            <option value="">Todos los clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className={btn.secondary}>Filtrar</button>
        </form>
      </div>
      {rows.length === 0 ? <Empty>No hay consultas en esta vista.</Empty> : (
        <Table head={["Fecha", "Lead", "Despacho", "Deuda", "Modalidad", "Estado", "Acciones"]}>
          {rows.map((r) => {
            const past = new Date(r.scheduled_at) < new Date();
            return (
              <tr key={r.id} className={past && r.status === "agendada" ? "bg-amber-50/50" : ""}>
                <Td>{dateTime(r.scheduled_at)}{r.reminder_sent_at && <div className="text-xs text-slate-400">recordatorio enviado</div>}</Td>
                <Td><A href={`/leads/${r.lead_id}`}>{r.full_name}</A>{r.phone && <div className="text-xs"><a href={telHref(r.phone)} className="text-slate-500">{r.phone}</a></div>}</Td>
                <Td>{r.cliente}</Td>
                <Td>{eur(r.debt_amount)}</Td>
                <Td className="capitalize">{r.mode}</Td>
                <Td><StatusBadge map={CONSULTATION_STATUS} value={r.status} />{r.confirmed_by && <div className="text-xs text-slate-400">por {r.confirmed_by}</div>}</Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1">
                    {r.status !== "asistida" && <form action={markConsultation.bind(null, r.id, "asistida")}><button className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500">Asistió</button></form>}
                    {r.status !== "no_asistio" && <form action={markConsultation.bind(null, r.id, "no_asistio")}><button className="rounded bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-200">No asistió</button></form>}
                    {r.status === "agendada" && <form action={markConsultation.bind(null, r.id, "cancelada")}><button className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200">Cancelar</button></form>}
                    <details className="relative">
                      <summary className="cursor-pointer list-none rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50">Mover</summary>
                      <form action={reschedule.bind(null, r.id)} className="absolute right-0 z-10 mt-1 flex gap-1 rounded-lg bg-white p-2 shadow-lg ring-1 ring-slate-200">
                        <input type="datetime-local" name="scheduled_at" defaultValue={toLocalInput(new Date(r.scheduled_at))} className={input} />
                        <button className={btn.secondary}>OK</button>
                      </form>
                    </details>
                  </div>
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
