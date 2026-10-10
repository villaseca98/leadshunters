// Panel público (sin login) del partner: sus leads sin teléfono ni email, su estado, lo que lleva generado y lo pagado.
// El enlace con token se lo mandas tú; es lo único que necesita.
import type { Metadata } from "next";
import { Logo } from "@/components/Sidebar";
import { StatusBadge } from "@/components/ui";
import { dateOnly, eur, shortName } from "@/lib/format";
import { PARTNER_STATUS, partnerLink, quarterLabel } from "@/lib/partners";
import { brandUrl, partnerByToken, partnerLeads, partnerQuarters } from "@/lib/services/partners";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu panel de partner", robots: { index: false, follow: false } };

export default async function PartnerPortal(props: PageProps<"/partner/[token]">) {
  const { token } = await props.params;
  const p = await partnerByToken(token);
  const [leads, quarters] = p ? await Promise.all([partnerLeads(p), partnerQuarters(p)]) : [[], []];
  const generado = quarters.reduce((a, q) => a + q.comision, 0);
  const pagado = quarters.reduce((a, q) => a + (q.pagado ?? 0), 0);
  const link = p ? partnerLink(brandUrl(), p.code) : "";
  const box = "rounded-[1.75rem] bg-white p-5 ring-1 ring-slate-200";
  return (
    <main className="min-h-dvh bg-paper px-5" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))", paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}>
      <div className="mx-auto w-full max-w-2xl">
        <Logo />
        {!p ? <p className="mt-16 text-slate-600">Enlace no válido o caducado.</p> : (
          <>
            <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Panel de partner · {p.code}</p>
            <h1 className="font-display mt-1 text-3xl font-semibold leading-tight">{p.name}</h1>
            <p className="mt-2 text-sm text-slate-600">Te llevas el {p.share_pct} % de lo que cobremos por cada cliente que entre con tu enlace o tu código. Se liquida cada trimestre.</p>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[["Clientes", String(leads.length)], ["Generado", eur(generado, 2)], ["Pendiente", eur(Math.max(0, generado - pagado), 2)]].map(([k, v]) => (
                <div key={k} className={box}><div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{k}</div><div className="num mt-2 text-xl font-semibold">{v}</div></div>
              ))}
            </div>

            <div className={`${box} mt-4`}>
              <div className="text-sm font-semibold">Tu enlace para clientes</div>
              <p className="mt-1 break-all font-mono text-xs text-indigo-700">{link}</p>
              <p className="mt-2 text-xs text-slate-500">Pégalo en tu boletín, tu WhatsApp de clientes o tu web. Si alguien entra sin el enlace, puede escribir tu código <b>{p.code}</b> en el formulario.</p>
            </div>

            <h2 className="mt-8 mb-3 font-display text-lg font-semibold">Tus clientes</h2>
            {leads.length === 0 ? <p className="text-sm text-slate-600">Aún no ha entrado nadie con tu código.</p> : (
              <ul className="grid gap-2">
                {leads.map((l) => (
                  <li key={l.id} className={`${box} flex items-center justify-between gap-3 !p-4`}>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{l.negocio || shortName(l.full_name)}</div>
                      <div className="text-xs text-slate-500">{l.line_emoji} {l.line_name} · {dateOnly(l.created_at)}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusBadge map={PARTNER_STATUS} value={l.status} />
                      {l.comision > 0 && <div className="num mt-1 text-sm font-semibold text-emerald-700">{eur(l.comision, 2)}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {quarters.length > 0 && (
              <>
                <h2 className="mt-8 mb-3 font-display text-lg font-semibold">Liquidaciones</h2>
                <ul className={`${box} divide-y divide-slate-100 !py-1`}>
                  {quarters.map((q) => (
                    <li key={q.periodo} className="flex items-center justify-between py-3 text-sm">
                      <span>{quarterLabel(q.periodo)} · {q.ganados} {q.ganados === 1 ? "cliente" : "clientes"}</span>
                      <span className="num font-semibold">{q.pagado != null ? `Pagado ${eur(q.pagado, 2)}` : eur(q.comision, 2)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">Al cerrar cada trimestre, mándanos tu factura con el importe pendiente y te lo transferimos en 15 días.</p>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
