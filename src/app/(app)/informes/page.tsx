// Informe interno de las tres líneas (despachos, luz, placas) para mejorar y optimizar. No se enseña a nadie.
import Link from "next/link";
import { currentMonth, eur, monthLabel, shiftMonth } from "@/lib/format";
import { reportInsights, reportText, type Insight } from "@/lib/insights";
import { buildReport, type Breakdown, type EnergyReport } from "@/lib/services/reports";
import { contactInfo } from "@/lib/settings";
import { Card, PageHeader, Stat, btn } from "@/components/ui";

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : "—");
const mins = (m: number | null) => (m == null ? "—" : m < 60 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`);
const delta = (now: number, prev: number) => (prev > 0 ? `${now >= prev ? "+" : "−"}${Math.abs(Math.round(((now - prev) / prev) * 100))} % vs mes anterior` : "sin datos del mes anterior");

const TONE: Record<Insight["tone"], string> = {
  bad: "border-l-rose-500 bg-rose-50/60",
  good: "border-l-emerald-500 bg-emerald-50/60",
  info: "border-l-indigo-400 bg-white",
};
const AREA: Record<Insight["area"], string> = { despachos: "⚖️ Despachos", luz: "💡 Luz", placas: "☀️ Placas", general: "📌 General" };

function BreakdownTable({ title, rows, won }: { title: string; rows: Breakdown[]; won: string }) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-slate-500">{title}</div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="max-w-48 truncate py-1.5 pr-2">{r.key}</td>
              <td className="num py-1.5 text-right text-slate-600">{r.leads}</td>
              <td className="num py-1.5 pl-3 text-right text-slate-600" title={won}>{r.won}</td>
              <td className="py-1.5 pl-2 text-right text-xs text-slate-500">{pct(r.won, r.leads)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EnergyCard({ r }: { r: EnergyReport }) {
  const name = r.vertical === "luz" ? "💡 Luz" : "☀️ Placas solares";
  return (
    <Card title={name} actions={<Link href={`/energia?linea=${r.vertical}`} className="text-xs font-semibold text-indigo-600">Ver leads</Link>}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-slate-500">Leads</dt><dd className="num font-semibold">{r.leads}</dd><dd className="text-xs text-slate-500">{delta(r.leads, r.prev_leads)}</dd></div>
        <div><dt className="text-xs text-slate-500">Contactados</dt><dd className="font-semibold"><span className="num">{r.contactados}</span> <span className="text-xs font-normal text-slate-500">{pct(r.contactados, r.leads)}</span></dd></div>
        <div><dt className="text-xs text-slate-500">1er contacto</dt><dd className="num font-semibold">{mins(r.speed_min)}</dd><dd className="text-xs text-slate-500">mediana</dd></div>
        <div><dt className="text-xs text-slate-500">Estudios enviados</dt><dd className="num font-semibold">{r.estudios}</dd></div>
        <div><dt className="text-xs text-slate-500">Contratos</dt><dd className="num font-semibold">{r.contratados}</dd><dd className="text-xs text-slate-500">{pct(r.contratados_de_mes, r.leads)} de los leads del mes</dd></div>
        <div><dt className="text-xs text-slate-500">Comisión</dt><dd className="num font-semibold text-emerald-700">{eur(r.comision)}</dd><dd className="text-xs text-slate-500">{r.contratados ? `${eur(r.comision / r.contratados)} por contrato` : ""}</dd></div>
      </dl>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <BreakdownTable title="Por prioridad (leads · contratos)" rows={r.priority} won="contratos" />
        <BreakdownTable title="Por canal" rows={r.channels} won="contratos" />
        <BreakdownTable title="Por campaña o reel" rows={r.campaigns} won="contratos" />
        <BreakdownTable title="Por provincia" rows={r.provinces} won="contratos" />
      </div>
      {r.lost.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">Descartes: {r.lost.map((l) => `${l.key} (${l.n})`).join(" · ")}</p>
      )}
    </Card>
  );
}

export default async function Informes(props: PageProps<"/informes">) {
  const sp = await props.searchParams;
  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : currentMonth();
  const r = await buildReport(month);
  const insights = reportInsights(r);
  const text = reportText(r, monthLabel(month), insights);
  const { phone } = await contactInfo();
  const d = r.despachos;
  const maxWeek = Math.max(1, ...r.weeks.map((w) => w.despachos + w.luz + w.placas));

  return (
    <>
      <PageHeader
        title="Informes"
        eyebrow="Solo para ti"
        subtitle={`Despachos, luz y placas en ${monthLabel(month)}: qué funciona y qué cambiar.`}
        actions={
          <>
            <Link href={`/informes?mes=${shiftMonth(month, -1)}`} className={btn.secondary}>← {monthLabel(shiftMonth(month, -1))}</Link>
            {month < currentMonth() && <Link href={`/informes?mes=${shiftMonth(month, 1)}`} className={btn.secondary}>{monthLabel(shiftMonth(month, 1))} →</Link>}
          </>
        }
      />

      <div className="lh-rail -mx-4 mb-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        <Stat label="⚖️ Despachos" value={eur(d.facturacion)} hint={`${d.leads} leads · ${d.asistidas} consultas hechas · ${d.clientes_activos} ${d.clientes_activos === 1 ? "cliente" : "clientes"}`} tone="good" />
        <Stat label="💡 Luz" value={eur(r.luz.comision)} hint={`${r.luz.leads} leads · ${r.luz.contratados} contratos`} tone="good" />
        <Stat label="☀️ Placas" value={eur(r.placas.comision)} hint={`${r.placas.leads} leads · ${r.placas.contratados} contratos`} tone="good" />
      </div>

      <Card title="Qué mejorar" className="mb-4">
        {insights.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay datos suficientes este mes para sacar conclusiones.</p>
        ) : (
          <ul className="space-y-2">
            {insights.map((i, n) => (
              <li key={n} className={`rounded-xl border border-l-4 border-slate-200 p-3 text-sm ${TONE[i.tone]}`}>
                <span className="mr-2 text-xs font-semibold text-slate-500">{AREA[i.area]}</span>{i.text}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="⚖️ Despachos (Segunda Oportunidad)" actions={<Link href="/leads" className="text-xs font-semibold text-indigo-600">Ver leads</Link>}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Leads</dt><dd className="num font-semibold">{d.leads}</dd><dd className="text-xs text-slate-500">{delta(d.leads, d.prev_leads)}</dd></div>
            <div><dt className="text-xs text-slate-500">Cualificados</dt><dd className="font-semibold"><span className="num">{d.cualificados}</span> <span className="text-xs font-normal text-slate-500">{pct(d.cualificados, d.leads)}</span></dd></div>
            <div><dt className="text-xs text-slate-500">Contactados</dt><dd className="font-semibold"><span className="num">{d.contactados}</span> <span className="text-xs font-normal text-slate-500">{pct(d.contactados, d.leads)}</span></dd></div>
            <div><dt className="text-xs text-slate-500">1ª llamada</dt><dd className="num font-semibold">{mins(d.speed_min)}</dd><dd className="text-xs text-slate-500">mediana · objetivo 5 min</dd></div>
            <div><dt className="text-xs text-slate-500">Consultas</dt><dd className="num font-semibold">{d.citas}</dd><dd className="text-xs text-slate-500">{d.asistidas} hechas · {d.no_asistio} no vinieron</dd></div>
            <div><dt className="text-xs text-slate-500">Facturación</dt><dd className="num font-semibold text-emerald-700">{eur(d.facturacion)}</dd></div>
            <div><dt className="text-xs text-slate-500">Tests de particulares</dt><dd className="num font-semibold">{d.tests}</dd><dd className="text-xs text-slate-500">{d.sin_despacho} sin despacho</dd></div>
            <div><dt className="text-xs text-slate-500">Llamadas a despachos</dt><dd className="num font-semibold">{d.llamadas_b2b}</dd><dd className="text-xs text-slate-500">{d.prospectos_interesados} interesados ahora</dd></div>
            <div><dt className="text-xs text-slate-500">Clientes nuevos</dt><dd className="num font-semibold">{d.clientes_nuevos}</dd></div>
          </dl>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <BreakdownTable title="Por campaña (leads · con consulta)" rows={d.campaigns} won="con consulta" />
            <BreakdownTable title="Por provincia" rows={d.provinces} won="con consulta" />
          </div>
        </Card>
        <EnergyCard r={r.luz} />
        <EnergyCard r={r.placas} />

        <Card title="Leads por semana (últimas 8)">
          <ul className="space-y-2 text-sm">
            {r.weeks.map((w) => (
              <li key={w.week} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3">
                <span className="num text-xs text-slate-500">{w.week}</span>
                <span className="flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                  <span className="bg-ink" style={{ width: `${(w.despachos / maxWeek) * 100}%` }} />
                  <span className="bg-amber-400" style={{ width: `${(w.luz / maxWeek) * 100}%` }} />
                  <span className="bg-blaze" style={{ width: `${(w.placas / maxWeek) * 100}%` }} />
                </span>
                <span className="num text-xs text-slate-600">{w.despachos} · {w.luz} · {w.placas}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span><span className="mr-1 inline-block size-2 rounded-full bg-ink" />Despachos</span>
            <span><span className="mr-1 inline-block size-2 rounded-full bg-amber-400" />Luz</span>
            <span><span className="mr-1 inline-block size-2 rounded-full bg-blaze" />Placas</span>
          </p>
        </Card>
      </div>

      <Card title="Resumen para enviarte" className="mt-4">
        <textarea readOnly rows={10} value={text} className="w-full rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-700 ring-1 ring-inset ring-slate-200" />
        <div className="mt-3 flex flex-wrap gap-2">
          {phone ? (
            <a href={`https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`} target="_blank" className={btn.primary}>Enviármelo por WhatsApp</a>
          ) : (
            <Link href="/ajustes" className={btn.secondary}>Pon tu teléfono en Ajustes para enviártelo por WhatsApp</Link>
          )}
          <a href={`/api/export/energia`} className={btn.secondary}>CSV de luz y placas</a>
          <a href={`/api/export/leads`} className={btn.secondary}>CSV de despachos</a>
        </div>
        <p className="mt-2 text-xs text-slate-500">n8n puede pedirlo cada semana en GET /api/v1/informes?mes=AAAA-MM (cabecera x-api-key) y mandarte el campo «texto».</p>
      </Card>
    </>
  );
}
