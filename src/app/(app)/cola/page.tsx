import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { QUALIFICATION, LEAD_STATUS, SOURCE } from "@/lib/labels";
import { ago, eur, nowMs, shortName } from "@/lib/format";
import { Empty, PageHeader, StatusBadge, Table, Td, btn, input } from "@/components/ui";
import { IconBolt } from "@/components/Sidebar";
import { takeNext } from "../leads/actions";

export default async function Cola(props: PageProps<"/cola">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const clients = await query<{ id: string; name: string }>("SELECT id, name FROM clients WHERE status = 'activo' ORDER BY name");
  const rows = await query<{
    id: string; full_name: string; cliente: string; source: string; created_at: string; next_call_at: string; attempts: number;
    status: string; qualification_status: string; debt_amount: number | null; locked_by_name: string | null; locked_by: string | null;
  }>(
    `SELECT l.id, l.full_name, c.name AS cliente, l.source, l.created_at, l.next_call_at, l.attempts, l.status, l.qualification_status,
            l.debt_amount, u.name AS locked_by_name, CASE WHEN l.locked_at > now() - interval '10 minutes' THEN l.locked_by END AS locked_by
       FROM leads l JOIN clients c ON c.id = l.client_id LEFT JOIN users u ON u.id = l.locked_by AND l.locked_at > now() - interval '10 minutes'
      WHERE c.status = 'activo' AND l.status IN ('nuevo','no_contesta','volver_a_llamar')
        AND l.qualification_status <> 'no_cualificado' AND l.phone IS NOT NULL
      ORDER BY (l.next_call_at <= now()) DESC, (l.attempts = 0) DESC,
               CASE l.qualification_status WHEN 'cualificado' THEN 0 WHEN 'pendiente' THEN 1 ELSE 2 END,
               CASE WHEN l.attempts = 0 THEN -extract(epoch FROM l.created_at) ELSE extract(epoch FROM l.next_call_at) END
      LIMIT 100`,
  );
  const ready = rows.filter((r) => new Date(r.next_call_at) <= new Date());
  const later = rows.filter((r) => new Date(r.next_call_at) > new Date());
  const oldestNew = ready.filter((r) => r.attempts === 0).map((r) => r.created_at).sort()[0];

  return (
    <>
      <PageHeader
        title="Cola de llamadas"
        eyebrow="Cazar"
        subtitle={`${ready.length} listos ahora · ${later.length} programados${oldestNew ? ` · el lead nuevo más antiguo entró ${ago(oldestNew)}` : ""}`}
      />
      <section className="mb-5 rounded-[1.75rem] bg-ink p-5 text-white sm:p-6">
        <form action={takeNext} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-white/60">Despacho</span>
            <select name="client_id" defaultValue={typeof sp.cliente === "string" ? sp.cliente : ""} className={`${input} bg-white/10 text-white ring-white/15 focus:bg-white/15 [&>option]:text-ink`}>
              <option value="">Todos los despachos</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <button className={`${btn.hunt} min-h-14 px-7 text-base`} disabled={!ready.length}>
            <IconBolt className="size-5" /> {ready.length ? "Cazar el siguiente lead" : "Nadie esperando"}
          </button>
        </form>
        {sp.vacia && <p className="mt-3 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">¡Cola vacía! No queda nadie por llamar ahora mismo.</p>}
        <p className="mt-3 text-xs leading-relaxed text-white/50">
          Primero los leads nuevos (el más reciente antes, porque cada minuto cuenta), luego cualificados, luego rellamadas.
          Al cogerlo queda reservado para ti 10 minutos, {shortName(user.name)}.
        </p>
      </section>

      {rows.length === 0 ? (
        <Empty>No hay leads en cola. Cuando entren por Meta o Google aparecerán aquí al instante.</Empty>
      ) : (
        <Table head={["Lead", "Cliente", "Origen", "Entró", "Intentos", "Estado", "Cualificación", "Deuda", "Siguiente llamada"]}>
          {rows.map((r) => (
            <tr key={r.id} className={new Date(r.next_call_at) > new Date() ? "opacity-50" : ""}>
              <Td primary className="font-semibold text-ink">
                {r.full_name}
                {r.locked_by && <div className="text-xs font-medium text-indigo-700">☏ {r.locked_by === user.id ? "Tú" : r.locked_by_name}</div>}
              </Td>
              <Td>{r.cliente}</Td>
              <Td hide>{SOURCE[r.source] ?? r.source}</Td>
              <Td className={r.attempts === 0 && nowMs() - new Date(r.created_at).getTime() > 5 * 60_000 ? "font-semibold text-rose-600" : ""}>{ago(r.created_at)}</Td>
              <Td hide>{r.attempts}</Td>
              <Td hide><StatusBadge map={LEAD_STATUS} value={r.status} /></Td>
              <Td><StatusBadge map={QUALIFICATION} value={r.qualification_status} /></Td>
              <Td>{eur(r.debt_amount)}</Td>
              <Td hide className="text-xs">{new Date(r.next_call_at) <= new Date() ? "Ahora" : ago(r.next_call_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
