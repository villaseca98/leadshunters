// Página pública (sin login) con el diagnóstico de captación de un despacho.
// Se la enviamos al despacho después de hablar con él; cada visita nos avisa (flujo 04 de n8n).
import type { Metadata } from "next";
import { headers } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { buildAudit, type AuditInput } from "@/lib/audit";
import { contactInfo } from "@/lib/settings";
import { emitEvent } from "@/lib/services/events";
import { appUrl } from "@/lib/appUrl";
import { dateOnly, telHref, waHref, nowMs } from "@/lib/format";
import { Logo } from "@/components/Sidebar";
import { matchProvince } from "@/lib/normalize";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Diagnóstico de captación · Leads Hunters", robots: { index: false, follow: false } };

type Row = AuditInput & { id: string; phone: string | null; audit_last_view_at: string | null; province: string | null };

// Las vistas previas de WhatsApp, Gmail, etc. no cuentan como visita
const BOT_RE = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|telegram|slack|discord|google-?(read|image)|bingpreview|headless/i;

export default async function Auditoria(props: PageProps<"/auditoria/[token]">) {
  const { token } = await props.params;
  const p = /^[0-9a-f]{32}$/.test(token)
    ? await queryOne<Row>(
        `SELECT id, name, city, phone, website, rating, reviews_count, instagram, instagram_days_since_post, website_has_form,
                website_has_whatsapp, website_has_pixel, meta_ads_active, call_hooks, audit_last_view_at, province
           FROM prospects WHERE audit_token = $1`,
        [token],
      )
    : null;
  if (!p) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-5">
        <div className="text-center"><Logo /><p className="mt-6 text-slate-600">Este enlace no es válido.</p></div>
      </main>
    );
  }

  const ua = (await headers()).get("user-agent") ?? "";
  if (!BOT_RE.test(ua) && !(await getUser())) {
    await query("UPDATE prospects SET audit_views = audit_views + 1, audit_last_view_at = now() WHERE id = $1", [p.id]);
    // un aviso por visita (no por cada recarga): si la anterior fue hace más de 30 minutos
    if (!p.audit_last_view_at || nowMs() - new Date(p.audit_last_view_at).getTime() > 30 * 60_000) {
      await emitEvent("prospecto.vio_auditoria", {
        prospect_id: p.id, nombre: p.name, ciudad: p.city, telefono: p.phone, enlace: `${appUrl()}/prospeccion/${p.id}`,
      });
    }
  }

  const city = p.city
    ? await queryOne<{ total: number; con_anuncios: number; reviews_rank: number | null }>(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE meta_ads_active)::int AS con_anuncios,
                (SELECT count(*)::int + 1 FROM prospects o WHERE lower(o.city) = lower($1) AND coalesce(o.reviews_count, 0) > coalesce($2::int, 0)) AS reviews_rank
           FROM prospects WHERE lower(city) = lower($1)`,
        [p.city, p.reviews_count],
      )
    : null;
  const a = buildAudit(p, city ?? { total: 0, con_anuncios: 0, reviews_rank: null });
  const c = await contactInfo();
  const prov = matchProvince(p.province) ?? matchProvince(p.city);
  const demand = prov
    ? await queryOne<{ n: number }>(
        "SELECT count(*)::int AS n FROM test_submissions WHERE province = $1 AND verdict <> 'no_apto' AND created_at > now() - interval '30 days'",
        [prov],
      ).catch(() => null)
    : null;
  const pct = a.total ? Math.round((a.passed / a.total) * 100) : 0;

  return (
    <main className="min-h-dvh bg-paper px-5" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))", paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}>
      <div className="mx-auto w-full max-w-xl">
        <Logo />

        <section className="mt-8 rounded-[1.75rem] bg-ink p-6 text-white">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Diagnóstico de captación online · {dateOnly(new Date())}</div>
          <h1 className="font-display mt-2 text-2xl font-semibold leading-tight sm:text-3xl">{p.name}</h1>
          {p.city && <div className="mt-1 text-sm text-white/60">{p.city}</div>}
          <div className="mt-6 flex items-end gap-4">
            <span className="lh-ring grid size-20 shrink-0 place-items-center rounded-full" style={{ ["--p" as string]: pct, ["--c" as string]: "var(--color-blaze)" }}>
              <span className="grid size-[calc(100%-9px)] place-items-center rounded-full bg-ink">
                <span className="num text-2xl font-semibold">{a.passed}/{a.total}</span>
              </span>
            </span>
            <p className="text-sm leading-snug text-white/75">
              puntos clave cubiertos para captar a personas con deudas que buscan un abogado de Segunda Oportunidad.
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-[1.75rem] bg-white p-5 ring-1 ring-slate-200">
          <ul className="divide-y divide-slate-100">
            {a.checks.map((ch) => (
              <li key={ch.label} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${ch.ok == null ? "bg-slate-100 text-slate-400" : ch.ok ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"}`}>
                  {ch.ok == null ? "?" : ch.ok ? "✓" : "✕"}
                </span>
                <div>
                  <div className="font-semibold">{ch.label}</div>
                  <div className="text-sm text-slate-500">{ch.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {demand && demand.n > 0 && (
          <section className="mt-4 rounded-[1.75rem] bg-moss p-5 text-white">
            <div className="num text-3xl font-semibold">{demand.n}</div>
            <p className="mt-1 text-sm text-white/85">
              {demand.n === 1 ? "persona" : "personas"} de {prov} con deudas que cumplen o pueden cumplir los requisitos nos han pedido ayuda en los últimos 30 días.
            </p>
          </section>
        )}

        {(a.reviews || a.market) && (
          <section className="mt-4 space-y-2 rounded-[1.75rem] bg-white p-5 text-sm leading-relaxed text-slate-700 ring-1 ring-slate-200">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Tu competencia</h2>
            {a.reviews && <p>{a.reviews}.</p>}
            {a.market && <p>{a.market}</p>}
          </section>
        )}

        <section className="mt-4 rounded-[1.75rem] bg-blaze p-6 text-blaze-ink">
          <h2 className="font-display text-xl font-semibold leading-tight">Consultas cualificadas, sin perseguir a nadie</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            <li>• Captamos a personas con deudas en tu zona con anuncios en Meta y Google.</li>
            <li>• Las llamamos en menos de 5 minutos y comprobamos deuda, acreedores e ingresos.</li>
            <li>• Te agendamos solo consultas cualificadas, con el resumen del caso.</li>
            <li>• Cuota fija más cada consulta que se realiza. Nunca un porcentaje de tus honorarios.</li>
          </ul>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {c.phone && <a href={waHref(c.phone)} className="grid min-h-12 place-items-center rounded-full bg-ink px-4 text-sm font-semibold text-white">Escribir por WhatsApp</a>}
            {c.phone && <a href={telHref(c.phone)} className="grid min-h-12 place-items-center rounded-full bg-white/70 px-4 text-sm font-semibold">Llamar a {c.name.split(" ")[0]}</a>}
            {!c.phone && c.email && <a href={`mailto:${c.email}?subject=${encodeURIComponent(`Diagnóstico de ${p.name}`)}`} className="grid min-h-12 place-items-center rounded-full bg-ink px-4 text-sm font-semibold text-white">Responder por email</a>}
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          Datos públicos de Google, tu web, tus redes y la Biblioteca de anuncios de Meta. {c.name}{c.email ? ` · ${c.email}` : ""}
        </p>
      </div>
    </main>
  );
}
