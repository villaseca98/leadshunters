import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { QUALIFICATION, LEAD_STATUS, SOURCE } from "@/lib/labels";
import { ago, eur, nowMs } from "@/lib/format";
import { Card, Empty, PageHeader, StatusBadge, Table, Td, btn, input } from "@/components/ui";
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
        subtitle={`${ready.length} listos ahora · ${later.length} programados${oldestNew ? ` · el lead nuevo más antiguo entró ${ago(oldestNew)}` : ""}`}
      />
      <Card className="mb-6">
        <form action={takeNext} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-600">Cliente</span>
            <select name="client_id" defaultValue={typeof sp.cliente === "string" ? sp.cliente : ""} className={input}>
              <option value="">Todos los clientes</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button className={`${btn.primary} px-6 py-3 text-base`} disabled={!ready.length}>⚡ Coger el siguiente lead</button>
        </form>
        {sp.vacia && <p className="mt-3 text-sm text-emerald-700">¡Cola vacía! No queda nadie por llamar ahora mismo.</p>}
        <p className="mt-3 text-xs text-slate-500">
          Orden: primero los leads nuevos (el más reciente antes, porque cada minuto cuenta), luego cualificados, luego rellamadas.
          Al coger un lead queda reservado para ti 10 minutos, {user.name}.
        </p>
      </Card>

      {rows.length === 0 ? (
        <Empty>No hay leads en cola. Cuando entren por Meta o Google aparecerán aquí al instante.</Empty>
      ) : (
        <Table head={["Lead", "Cliente", "Origen", "Entró", "Intentos", "Estado", "Cualificación", "Deuda", "Siguiente llamada"]}>
          {rows.map((r) => (
            <tr key={r.id} className={new Date(r.next_call_at) > new Date() ? "opacity-50" : ""}>
              <Td className="font-medium text-slate-900">
                {r.full_name}
                {r.locked_by && <div className="text-xs text-indigo-600">☏ {r.locked_by === user.id ? "Tú" : r.locked_by_name}</div>}
              </Td>
              <Td>{r.cliente}</Td>
              <Td>{SOURCE[r.source] ?? r.source}</Td>
              <Td className={r.attempts === 0 && nowMs() - new Date(r.created_at).getTime() > 5 * 60_000 ? "font-semibold text-rose-600" : ""}>{ago(r.created_at)}</Td>
              <Td>{r.attempts}</Td>
              <Td><StatusBadge map={LEAD_STATUS} value={r.status} /></Td>
              <Td><StatusBadge map={QUALIFICATION} value={r.qualification_status} /></Td>
              <Td>{eur(r.debt_amount)}</Td>
              <Td className="text-xs">{new Date(r.next_call_at) <= new Date() ? "Ahora" : ago(r.next_call_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
