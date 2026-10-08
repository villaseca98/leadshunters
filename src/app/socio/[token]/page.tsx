// Página pública (sin login) para el instalador o la comercializadora: acepta o rechaza el lead
// y va marcando visita, presupuesto y obra firmada. El enlace le llega por email desde n8n.
// Antes de aceptar solo ve los datos del negocio; el contacto aparece al aceptarlo.
import { revalidatePath } from "next/cache";
import { Logo } from "@/components/Sidebar";
import { StageForm } from "@/components/deals/StageForm";
import { stageExtra } from "@/lib/dealForm";
import { DEAL_STAGE, ROOFS, VERTICALS } from "@/lib/energy";
import { dateTime, eur, telHref } from "@/lib/format";
import { dealByToken, setDealStage } from "@/lib/services/deals";

export const dynamic = "force-dynamic";

async function decide(token: string, stage: "aceptado" | "rechazado", formData: FormData) {
  "use server";
  const d = await dealByToken(token);
  if (!d || d.stage !== "enviado") return;
  await setDealStage(d.id, stage, "socio", { note: String(formData.get("note") ?? "").trim() || null });
  revalidatePath(`/socio/${token}`);
}

async function advance(token: string, formData: FormData) {
  "use server";
  const d = await dealByToken(token);
  if (!d) return;
  await setDealStage(d.id, String(formData.get("stage") ?? ""), "socio", stageExtra(formData));
  revalidatePath(`/socio/${token}`);
}

export default async function Socio(props: PageProps<"/socio/[token]">) {
  const { token } = await props.params;
  const d = await dealByToken(token);
  const st = d ? DEAL_STAGE[d.stage] : null;
  const pending = d?.stage === "enviado";
  const showContact = d && !pending && d.stage !== "rechazado";
  const deadline = d ? new Date(new Date(d.created_at).getTime() + d.accept_hours * 3600_000) : null;
  const row = (k: string, v: React.ReactNode) => v == null || v === "" ? null : (
    <div className="flex justify-between gap-4 py-2"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
  );

  return (
    <main className="flex min-h-dvh flex-col bg-paper px-5" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <Logo />
        {!d || !st ? (
          <p className="mt-16 text-slate-600">Enlace no válido o caducado.</p>
        ) : (
          <div className="flex flex-1 flex-col">
            <div className="mt-10 rounded-[1.75rem] bg-white p-6 ring-1 ring-slate-200">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span>{d.cliente}</span><span>{VERTICALS[d.vertical].label}</span>
              </div>
              <h1 className="font-display mt-2 text-2xl font-semibold leading-tight">
                {pending ? "Nuevo cliente interesado" : showContact ? d.full_name : "Lead rechazado"}
              </h1>
              <p className="mt-1 text-sm text-slate-600">{st.label} · {st.hint}</p>
              <dl className="mt-4 divide-y divide-slate-100 text-sm">
                {row("Negocio", d.business_type)}
                {row("Zona", [d.postal_code, d.province].filter(Boolean).join(" · "))}
                {row("Factura de luz", d.monthly_bill != null ? `${eur(d.monthly_bill)}/mes` : null)}
                {row("Tarifa", d.tariff)}
                {row("Potencia contratada", d.contracted_power_kw != null ? `${d.contracted_power_kw} kW` : null)}
                {row("Cubierta", d.roof ? ROOFS[d.roof] ?? d.roof : null)}
                {row("Consumo de día", d.daytime_share != null ? `${d.daytime_share} %` : null)}
                {row("Comercializadora actual", d.current_supplier)}
                {showContact && row("Teléfono", d.phone ? <a className="text-indigo-700" href={telHref(d.phone)}>{d.phone}</a> : null)}
                {showContact && row("Email", d.email)}
                {row("Visita", d.visit_at ? dateTime(d.visit_at) : null)}
                {row("Presupuesto", d.budget_amount != null ? eur(d.budget_amount) : null)}
                {row("Obra firmada", d.signed_amount != null ? eur(d.signed_amount) : null)}
              </dl>
              {d.notes && <p className="mt-3 whitespace-pre-line rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{d.notes}</p>}
            </div>

            {pending ? (
              <div className="mt-auto grid gap-3 pt-8">
                <form action={decide.bind(null, token, "aceptado")}>
                  <button className="min-h-14 w-full rounded-full bg-emerald-600 text-base font-semibold text-white active:scale-[0.98]">Lo acepto: ver contacto</button>
                </form>
                <form action={decide.bind(null, token, "rechazado")} className="grid gap-2">
                  <input name="note" required placeholder="Motivo: fuera de zona, no encaja…" className="min-h-12 rounded-full bg-white px-4 text-sm ring-1 ring-slate-300" />
                  <button className="min-h-14 w-full rounded-full bg-white text-base font-semibold text-ink ring-1 ring-slate-300 active:scale-[0.98]">Rechazar</button>
                </form>
                <p className="text-center text-xs text-slate-500">
                  Tienes hasta el {deadline ? dateTime(deadline) : "plazo acordado"} para rechazarlo. Si no respondes, cuenta como aceptado.
                </p>
              </div>
            ) : d.stage !== "rechazado" ? (
              <div className="mt-6 rounded-[1.75rem] bg-white p-6 ring-1 ring-slate-200">
                <h2 className="mb-3 text-sm font-semibold">¿Cómo va?</h2>
                <StageForm deal={d} action={advance.bind(null, token)} partner />
                {!["firmado", "activado", "perdido"].includes(d.stage) && (
                  <p className="mt-3 text-xs text-slate-500">Marca «Firmado» con el importe de la obra cuando el cliente firme.</p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
