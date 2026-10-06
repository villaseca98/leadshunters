// Panel privado del despacho (sin login, enlace secreto que se puede regenerar desde su ficha).
// Ve sus consultas, confirma las realizadas, marca los casos firmados y ve lo que gana frente a lo que paga.
import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { clientByPortalToken, monthSummary } from "@/lib/services/portal";
import { setConsultationStatus } from "@/lib/services/leads";
import { contactInfo } from "@/lib/settings";
import { CONSULTATION_STATUS } from "@/lib/labels";
import { currentMonth, dateTime, monthLabel, nowMs, shiftMonth, telHref, waHref } from "@/lib/format";
import { planName } from "@/lib/plans";
import { Logo } from "@/components/Sidebar";
import { StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu panel · Leads Hunters", robots: { index: false, follow: false } };

const e = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

async function ownConsultation(token: string, id: string) {
  const c = await clientByPortalToken(token);
  if (!c || !/^[0-9a-f-]{36}$/.test(id)) return null;
  return queryOne<{ id: string; scheduled_at: string }>("SELECT id, scheduled_at FROM consultations WHERE id = $1 AND client_id = $2", [id, c.id]);
}

async function confirm(token: string, id: string, status: "asistida" | "no_asistio") {
  "use server";
  const co = await ownConsultation(token, id);
  if (!co || new Date(co.scheduled_at) > new Date(Date.now() + 3600_000)) return;
  await setConsultationStatus(co.id, status, "despacho");
  revalidatePath(`/portal/${token}`);
}

async function markCase(token: string, id: string, fd: FormData) {
  "use server";
  const co = await ownConsultation(token, id);
  if (!co) return;
  const signed = fd.get("signed") === "1";
  const fee = Number(String(fd.get("fee") ?? "").replace(/\./g, "").replace(",", "."));
  await query(
    `UPDATE consultations SET case_signed = $2, case_fee = $3, case_signed_at = CASE WHEN $2 THEN coalesce(case_signed_at, now()) END, updated_at = now()
      WHERE id = $1 AND status = 'asistida'`,
    [co.id, signed, signed && Number.isFinite(fee) && fee > 0 ? fee : null],
  );
  revalidatePath(`/portal/${token}`);
}

type Row = { id: string; scheduled_at: string; status: string; full_name: string; phone: string; case_signed: boolean | null; case_fee: number | null };

export default async function Portal(props: PageProps<"/portal/[token]">) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  const c = await clientByPortalToken(token);
  if (!c) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-5">
        <div className="text-center"><Logo /><p className="mt-6 text-slate-600">Este enlace no es válido o ha caducado.</p></div>
      </main>
    );
  }
  const now = currentMonth();
  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) && sp.mes <= now ? sp.mes : now;
  const s = await monthSummary(c, month);
  const b = s.billing;
  const rows = await query<Row>(
    `SELECT co.id, co.scheduled_at, co.status, l.full_name, l.phone, co.case_signed, co.case_fee::float AS case_fee
       FROM consultations co JOIN leads l ON l.id = co.lead_id
      WHERE co.client_id = $1 AND (to_char(co.scheduled_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') = $2
         OR ($2 = $3 AND co.status = 'agendada'))
      ORDER BY co.scheduled_at`,
    [c.id, month, now],
  );
  const soon = nowMs() + 3600_000;
  const pending = rows.filter((r) => r.status === "agendada" && new Date(r.scheduled_at).getTime() <= soon);
  const upcoming = rows.filter((r) => r.status === "agendada" && new Date(r.scheduled_at).getTime() > soon);
  const held = rows.filter((r) => r.status === "asistida");
  const others = rows.filter((r) => r.status !== "agendada" && r.status !== "asistida");
  const us = await contactInfo();
  const href = (m: string) => `/portal/${token}?mes=${m}`;

  return (
    <main className="min-h-dvh bg-paper px-5" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))", paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}>
      <div className="mx-auto w-full max-w-xl">
        <Logo />

        <section className="mt-8 rounded-[1.75rem] bg-ink p-6 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Tu panel · Plan {planName(c.plan)}</div>
          <h1 className="font-display mt-2 text-2xl font-semibold leading-tight sm:text-3xl">{c.name}</h1>
          <div className="mt-5 flex items-center justify-between gap-3">
            <Link href={href(shiftMonth(month, -1))} className="grid size-10 place-items-center rounded-full bg-white/10 text-lg" aria-label="Mes anterior">←</Link>
            <div className="text-center text-base font-semibold first-letter:uppercase">{monthLabel(month)}</div>
            {month < now ? <Link href={href(shiftMonth(month, 1))} className="grid size-10 place-items-center rounded-full bg-white/10 text-lg" aria-label="Mes siguiente">→</Link> : <span className="size-10" />}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {[
              ["Personas interesadas", b?.leads ?? 0, `${b?.leads_cualificados ?? 0} cumplen requisitos`],
              ["Consultas agendadas", b?.citas_agendadas ?? 0, `${b?.citas_pendientes ?? 0} por celebrar`],
              ["Consultas realizadas", b?.citas_asistidas ?? 0, `${b?.citas_no_asistio ?? 0} no se presentaron`],
              ["Casos firmados", s.casos_firmados, s.honorarios ? `${e(s.honorarios)} en honorarios` : "Márcalos abajo"],
            ].map(([l, v, h]) => (
              <div key={l as string} className="rounded-2xl bg-white/[0.07] p-3.5">
                <div className="text-[11px] font-medium text-white/55">{l}</div>
                <div className="num mt-1 text-2xl font-semibold">{v}</div>
                <div className="mt-0.5 text-xs text-white/55">{h}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-[1.75rem] bg-moss p-5 text-white">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Lo que ganas frente a lo que pagas</h2>
          {s.retorno != null ? (
            <p className="mt-2"><span className="num font-display text-4xl font-semibold">{s.retorno.toLocaleString("es-ES", { maximumFractionDigits: 1 })} €</span> <span className="text-white/85">en honorarios por cada euro invertido.</span></p>
          ) : (
            <p className="mt-2 text-sm text-white/85">Marca los casos que firmes con sus honorarios y aquí verás tu retorno real.</p>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-white/70">Honorarios de casos firmados</dt><dd className="num text-right font-semibold">{e(s.honorarios)}</dd>
            <dt className="text-white/70">Nuestra factura</dt><dd className="num text-right font-semibold">{e(b?.total ?? 0)}</dd>
            {s.inversion_anuncios != null && (<><dt className="text-white/70">Anuncios (Meta y Google)</dt><dd className="num text-right font-semibold">{e(s.inversion_anuncios)}</dd></>)}
            {s.coste_por_consulta != null && (<><dt className="text-white/70">Coste por consulta realizada</dt><dd className="num text-right font-semibold">{e(s.coste_por_consulta)}</dd></>)}
          </dl>
        </section>

        {pending.length > 0 && (
          <Section title="¿Se realizaron estas consultas?" note="Solo cobramos las consultas realizadas. Confírmalas aquí.">
            {pending.map((r) => (
              <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                <Person r={r} />
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <form action={confirm.bind(null, token, r.id, "asistida")}><button className="min-h-11 w-full rounded-full bg-emerald-600 text-sm font-semibold text-white">Sí, se realizó</button></form>
                  <form action={confirm.bind(null, token, r.id, "no_asistio")}><button className="min-h-11 w-full rounded-full bg-white text-sm font-semibold text-ink ring-1 ring-slate-300">No se presentó</button></form>
                </div>
              </li>
            ))}
          </Section>
        )}

        {upcoming.length > 0 && (
          <Section title="Próximas consultas">
            {upcoming.map((r) => <li key={r.id} className="py-3 first:pt-0 last:pb-0"><Person r={r} /></li>)}
          </Section>
        )}

        <Section title="Consultas realizadas" note="¿Firmó? Márcalo con sus honorarios. Es solo para tu informe de retorno: no cambia lo que te cobramos.">
          {held.length === 0 ? <li className="text-sm text-slate-500">Todavía no hay consultas realizadas este mes.</li> : held.map((r) => (
            <li key={r.id} className="py-3 first:pt-0 last:pb-0">
              <Person r={r} />
              <form key={`${r.case_signed}-${r.case_fee}`} action={markCase.bind(null, token, r.id)} className="mt-2.5 flex items-center gap-2">
                <select name="signed" defaultValue={r.case_signed ? "1" : "0"} className="min-h-11 rounded-xl bg-slate-50 px-3 text-sm ring-1 ring-slate-200">
                  <option value="0">No firmó</option><option value="1">Firmó</option>
                </select>
                <input name="fee" inputMode="decimal" placeholder="Honorarios €" defaultValue={r.case_fee ?? ""} className="min-h-11 w-full min-w-0 rounded-xl bg-slate-50 px-3 text-sm ring-1 ring-slate-200" />
                <button className="min-h-11 shrink-0 rounded-full bg-ink px-4 text-sm font-semibold text-white">Guardar</button>
              </form>
            </li>
          ))}
        </Section>

        {others.length > 0 && (
          <Section title="Otras consultas del mes">
            {others.map((r) => <li key={r.id} className="py-3 first:pt-0 last:pb-0"><Person r={r} /></li>)}
          </Section>
        )}

        <Section title="Tu factura del mes">
          <li className="space-y-1.5 text-sm">
            <Line l="Cuota fija" v={e(b?.importe_fijo ?? 0)} />
            <Line l={`${b?.consultas_facturables ?? 0} consultas realizadas`} v={e(b?.importe_variable ?? 0)} />
            {(b?.citas_gratis_retraso ?? 0) > 0 && <Line l={`${b!.citas_gratis_retraso} gratis por llamada tardía (garantía)`} v="0 €" />}
            {(b?.citas_no_asistio ?? 0) > 0 && <Line l={`${b!.citas_no_asistio} no se presentaron`} v="0 €" />}
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold"><span>Total</span><span className="num">{e(b?.total ?? 0)}</span></div>
          </li>
        </Section>

        {(us.phone || us.email) && (
          <div className={`mt-6 grid gap-2.5 ${us.phone ? "grid-cols-2" : ""}`}>
            {us.phone && <a href={waHref(us.phone)} className="grid min-h-12 place-items-center rounded-full bg-blaze text-sm font-semibold text-blaze-ink">WhatsApp {us.name.split(" ")[0]}</a>}
            {us.phone ? <a href={telHref(us.phone)} className="grid min-h-12 place-items-center rounded-full bg-white text-sm font-semibold ring-1 ring-slate-300">Llamar</a>
              : <a href={`mailto:${us.email}`} className="grid min-h-12 place-items-center rounded-full bg-white text-sm font-semibold ring-1 ring-slate-300">Escribirnos un email</a>}
          </div>
        )}
        <p className="mt-6 text-center text-xs text-slate-500">Enlace privado de {c.name}. No lo compartas.</p>
      </div>
    </main>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-[1.75rem] bg-white p-5 ring-1 ring-slate-200">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h2>
      {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
      <ul className="mt-3 divide-y divide-slate-100">{children}</ul>
    </section>
  );
}

function Person({ r }: { r: Row }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-white">{r.full_name.slice(0, 1)}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{r.full_name}</div>
        <div className="text-xs text-slate-500">{dateTime(r.scheduled_at)} · <a href={telHref(r.phone)} className="underline">{r.phone}</a></div>
      </div>
      <StatusBadge map={CONSULTATION_STATUS} value={r.status} />
    </div>
  );
}

const Line = ({ l, v }: { l: string; v: string }) => <div className="flex justify-between gap-3 text-slate-600"><span>{l}</span><span className="num">{v}</span></div>;
