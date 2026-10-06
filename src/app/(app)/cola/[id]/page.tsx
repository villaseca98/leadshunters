import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { CALL_OUTCOME, LEAD_STATUS, QUALIFICATION, SOURCE } from "@/lib/labels";
import { dateTime, toLocalInput, nowMs } from "@/lib/format";
import { toCallableTime } from "@/lib/schedule";
import { Card, PageHeader, StatusBadge, btn } from "@/components/ui";
import { CallScreen } from "@/components/call/CallScreen";
import { logCallAction, release } from "../../leads/actions";

export default async function CallPage(props: PageProps<"/cola/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const lead = await queryOne<{
    id: string; full_name: string; phone: string | null; email: string | null; province: string | null; debt_amount: number | null;
    creditors_count: number | null; monthly_income: number | null; employment_status: string | null; owns_home: boolean | null;
    prior_lso: boolean | null; criminal_record: boolean | null; created_at: string; status: string; qualification_status: string;
    qualification_score: number; qualification_reasons: string[]; source: string; campaign: string | null; attempts: number;
    cliente: string; client_id: string; calendar_url: string | null; min_debt: number;
  }>(
    `SELECT l.*, c.name AS cliente, c.calendar_url, c.min_debt FROM leads l JOIN clients c ON c.id = l.client_id WHERE l.id = $1`,
    [id],
  );
  if (!lead) notFound();
  const calls = await query<{ outcome: string; notes: string | null; created_at: string; user_name: string | null }>(
    "SELECT c.outcome, c.notes, c.created_at, u.name AS user_name FROM calls c LEFT JOIN users u ON u.id = c.user_id WHERE lead_id = $1 ORDER BY c.created_at DESC",
    [id],
  );
  // propuesta de hueco: mañana a las 10:00 o la siguiente hora hábil
  const slot = toCallableTime(new Date(nowMs() + 24 * 3600_000));
  slot.setUTCMinutes(0);

  return (
    <>
      <PageHeader
        title={`Llamada · ${lead.cliente}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge map={LEAD_STATUS} value={lead.status} />
            <StatusBadge map={QUALIFICATION} value={lead.qualification_status} />
            <span>{SOURCE[lead.source] ?? lead.source}{lead.campaign ? ` · ${lead.campaign}` : ""} · intento {lead.attempts + 1}</span>
          </span>
        }
        actions={<form action={release.bind(null, id)}><button className={btn.ghost}>Soltar lead y volver</button></form>}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CallScreen
            lead={lead}
            action={logCallAction.bind(null, id)}
            defaultSlot={toLocalInput(slot)}
            fromQueue={true}
            clientFilter={typeof sp.cliente === "string" ? sp.cliente : ""}
            calendarUrl={lead.calendar_url}
          />
        </div>
        <div className="space-y-6">
          <Card title={`Cualificación: ${lead.qualification_score}/100`}>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {lead.qualification_reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Mínimo de deuda de este despacho: {lead.min_debt.toLocaleString("es-ES")} €</p>
          </Card>
          <Card title="Guion de llamada">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
              <li>«Hola {lead.full_name.split(" ")[0]}, soy [nombre] del equipo de {lead.cliente}. Nos dejaste tus datos hace un momento sobre tus deudas, ¿tienes dos minutos?»</li>
              <li>«Para ver si la Ley de Segunda Oportunidad encaja contigo: ¿cuánto debes en total, más o menos? ¿Con cuántos bancos o financieras?»</li>
              <li>«¿Tienes ingresos ahora mismo? ¿Tienes casa en propiedad?»</li>
              <li>«¿Has usado esta ley en los últimos 5 años? ¿Alguna condena por delitos económicos?» (si es que sí, no cualifica)</li>
              <li>«Por lo que me cuentas, un abogado especialista puede revisar tu caso sin compromiso. ¿Te va bien el [día] a las [hora]?»</li>
              <li>Confirma teléfono y email. «Te llegará un recordatorio antes de la cita.»</li>
            </ol>
          </Card>
          {calls.length > 0 && (
            <Card title="Llamadas anteriores">
              <ul className="space-y-2 text-sm">
                {calls.map((c, i) => (
                  <li key={i}>
                    <span className="text-xs text-slate-500">{dateTime(c.created_at)}</span> · <b>{CALL_OUTCOME[c.outcome]}</b>
                    {c.user_name && <span className="text-xs text-slate-400"> · {c.user_name}</span>}
                    {c.notes && <p className="text-slate-600">{c.notes}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
