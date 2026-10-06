import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { CALL_OUTCOME, CONSULTATION_STATUS, LEAD_STATUS, QUALIFICATION, SOURCE } from "@/lib/labels";
import { dateTime, toLocalInput, nowMs } from "@/lib/format";
import { toCallableTime } from "@/lib/schedule";
import { A, Card, PageHeader, StatusBadge, btn } from "@/components/ui";
import { CallScreen } from "@/components/call/CallScreen";
import { eraseLead, logCallAction } from "../actions";

export default async function LeadPage(props: PageProps<"/leads/[id]">) {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await getUser();
  const lead = await queryOne<{
    id: string; full_name: string; phone: string | null; email: string | null; province: string | null; debt_amount: number | null;
    creditors_count: number | null; monthly_income: number | null; employment_status: string | null; owns_home: boolean | null;
    prior_lso: boolean | null; criminal_record: boolean | null; created_at: string; status: string; qualification_status: string;
    qualification_score: number; qualification_reasons: string[]; source: string; campaign: string | null; ad_name: string | null;
    attempts: number; consent_at: string | null; consent_text: string | null; notes: string | null; next_call_at: string;
    cliente: string; client_id: string; calendar_url: string | null; external_id: string | null;
  }>("SELECT l.*, c.name AS cliente, c.calendar_url FROM leads l JOIN clients c ON c.id = l.client_id WHERE l.id = $1", [id]);
  if (!lead) notFound();
  const calls = await query<{ outcome: string; notes: string | null; created_at: string; duration_s: number | null; user_name: string | null }>(
    "SELECT c.outcome, c.notes, c.created_at, c.duration_s, u.name AS user_name FROM calls c LEFT JOIN users u ON u.id = c.user_id WHERE lead_id = $1 ORDER BY c.created_at DESC",
    [id],
  );
  const consults = await query<{ id: string; scheduled_at: string; status: string; mode: string }>(
    "SELECT id, scheduled_at, status, mode FROM consultations WHERE lead_id = $1 ORDER BY scheduled_at DESC",
    [id],
  );
  const slot = toCallableTime(new Date(nowMs() + 24 * 3600_000));

  return (
    <>
      <PageHeader
        title={lead.full_name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge map={LEAD_STATUS} value={lead.status} />
            <StatusBadge map={QUALIFICATION} value={lead.qualification_status} />
            <span>{lead.cliente} · {SOURCE[lead.source] ?? lead.source}{lead.campaign ? ` · ${lead.campaign}` : ""} · entró {dateTime(lead.created_at)}</span>
          </span>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CallScreen lead={lead} action={logCallAction.bind(null, id)} defaultSlot={toLocalInput(slot)} fromQueue={false} clientFilter="" calendarUrl={lead.calendar_url} />
        </div>
        <div className="space-y-6">
          <Card title={`Cualificación: ${lead.qualification_score}/100`}>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {lead.qualification_reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </Card>
          <Card title="Consultas">
            {consults.length === 0 ? <p className="text-sm text-slate-500">Sin consultas.</p> : (
              <ul className="space-y-2 text-sm">
                {consults.map((c) => (
                  <li key={c.id} className="flex items-center justify-between">
                    <span>{dateTime(c.scheduled_at)} · {c.mode}</span>
                    <StatusBadge map={CONSULTATION_STATUS} value={c.status} />
                  </li>
                ))}
              </ul>
            )}
            <A href="/citas" className="mt-3 block text-xs">Gestionar en Consultas →</A>
          </Card>
          <Card title="Llamadas">
            {calls.length === 0 ? <p className="text-sm text-slate-500">Aún no se le ha llamado.</p> : (
              <ul className="space-y-2 text-sm">
                {calls.map((c, i) => (
                  <li key={i}>
                    <span className="text-xs text-slate-500">{dateTime(c.created_at)}</span> · <b>{CALL_OUTCOME[c.outcome]}</b>
                    {c.duration_s ? <span className="text-xs text-slate-400"> · {Math.round(c.duration_s / 60)} min</span> : null}
                    {c.user_name && <span className="text-xs text-slate-400"> · {c.user_name}</span>}
                    {c.notes && <p className="text-slate-600">{c.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">Próxima llamada programada: {dateTime(lead.next_call_at)}</p>
          </Card>
          <Card title="Consentimiento y RGPD">
            <dl className="space-y-1 text-sm">
              <dt className="text-xs text-slate-500">Consentimiento</dt>
              <dd>{dateTime(lead.consent_at)}</dd>
              {lead.consent_text && <dd className="text-xs text-slate-600">{lead.consent_text}</dd>}
              {lead.external_id && <><dt className="pt-1 text-xs text-slate-500">ID en la plataforma</dt><dd className="font-mono text-xs">{lead.external_id}</dd></>}
            </dl>
            {user?.role === "admin" && lead.full_name !== "Suprimido (RGPD)" && (
              <form action={eraseLead.bind(null, id)} className="mt-4">
                <button className={`${btn.danger} w-full`}>Suprimir datos personales (derecho de supresión)</button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
