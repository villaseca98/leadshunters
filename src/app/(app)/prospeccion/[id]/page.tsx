import { notFound } from "next/navigation";
import Link from "next/link";
import { query, queryOne } from "@/lib/db";
import { ACTIVITY_KIND, PROSPECT_STATUS } from "@/lib/labels";
import { ago, dateTime, telHref, toLocalInput, waHref, nowMs } from "@/lib/format";
import type { ScoreLine } from "@/lib/scoring";
import { A, Badge, Card, PageHeader, ScorePill, StatusBadge, btn, input, label } from "@/components/ui";
import { appUrl } from "@/lib/appUrl";
import { auditMessage } from "@/lib/audit";
import { contactInfo } from "@/lib/settings";
import { analyzeWebsite, convertToClient, logProspectActivity, saveProspectNotes, setMetaAds, updateProspectStatus } from "../actions";

type P = {
  id: string; name: string; category: string | null; address: string | null; city: string | null; province: string | null;
  phone: string | null; email: string | null; website: string | null; google_maps_url: string | null; rating: number | null;
  reviews_count: number | null; instagram: string | null; facebook: string | null; linkedin: string | null; tiktok: string | null;
  youtube: string | null; instagram_followers: number | null; instagram_days_since_post: number | null;
  website_mentions_lso: boolean | null; website_has_form: boolean | null; website_has_whatsapp: boolean | null; website_has_pixel: boolean | null;
  meta_ads_active: boolean | null; meta_ads_count: number | null; meta_ads_lso: boolean | null; meta_ads_checked_at: string | null;
  enriched_at: string | null; score: number; score_tier: string; score_breakdown: ScoreLine[]; call_hooks: string[];
  audit_token: string | null; audit_views: number; audit_last_view_at: string | null;
  status: string; next_action_at: string | null; notes: string | null; source: string; search_term: string | null; created_at: string;
};

const yn = (v: boolean | null) => (v == null ? <span className="text-slate-400">¿?</span> : v ? <span className="text-emerald-600">Sí</span> : <span className="text-rose-600">No</span>);

export default async function ProspectPage(props: PageProps<"/prospeccion/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const callMode = sp.modo === "llamada";
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await queryOne<P>("SELECT * FROM prospects WHERE id = $1", [id]);
  if (!p) notFound();
  const acts = await query<{ id: string; kind: string; outcome: string | null; notes: string | null; created_at: string; user_name: string | null }>(
    `SELECT a.id, a.kind, a.outcome, a.notes, a.created_at, u.name AS user_name FROM prospect_activities a
       LEFT JOIN users u ON u.id = a.user_id WHERE a.prospect_id = $1 ORDER BY a.created_at DESC LIMIT 50`,
    [id],
  );
  const client = await queryOne<{ id: string }>("SELECT id FROM clients WHERE prospect_id = $1", [id]);
  const adLibrary = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ES&q=${encodeURIComponent(p.name)}`;
  const tomorrow = new Date(nowMs() + 24 * 3600_000);
  const me = await contactInfo();
  const auditLink = p.audit_token ? `${appUrl()}/auditoria/${p.audit_token}` : null;
  const msg = auditLink ? auditMessage(p, auditLink, me.name || "el equipo") : null;
  const waDigits = p.phone?.replace(/[^\d]/g, "") ?? "";
  const waNumber = waDigits.length === 9 ? `34${waDigits}` : waDigits;

  const log = logProspectActivity.bind(null, id);
  const outcomes: [string, string, string][] = [
    ["no_contesta", "No contesta", btn.secondary],
    ["llamar_mas_tarde", "Llamar más tarde", btn.secondary],
    ["hablar_con_decisor", "Hablé, no decide él/ella", btn.secondary],
    ["no_interesa", "No le interesa", btn.danger],
    ["interesado", "Interesado", btn.primary],
    ["reunion", "Reunión agendada", btn.success],
  ];

  return (
    <>
      <PageHeader
        title={p.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <ScorePill score={p.score} tier={p.score_tier} size="lg" />
            <StatusBadge map={PROSPECT_STATUS} value={p.status} />
            <span>{[p.city, p.province].filter(Boolean).join(", ")}</span>
            {p.category && <span className="text-slate-400">· {p.category}</span>}
          </span>
        }
        actions={
          <>
            {p.phone && <a href={telHref(p.phone)} className={`${btn.hunt} flex-1 sm:flex-none`}>Llamar {p.phone}</a>}
            {callMode && <Link href="/prospeccion/llamar" className={btn.secondary}>Saltar →</Link>}
            {client ? (
              <Link href={`/clientes/${client.id}`} className={btn.secondary}>Ver ficha de cliente</Link>
            ) : (
              <form action={convertToClient.bind(null, id)}><button className={btn.secondary}>⚖ Convertir en cliente</button></form>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2 lg:space-y-6">
          <Card title="Registrar llamada" className={callMode ? "ring-2 ring-blaze" : ""}>
            {p.call_hooks.length > 0 && (
              <div className="mb-4 rounded-2xl bg-indigo-50 p-3.5 text-sm text-indigo-900">
                <div className="mb-1 font-semibold">Ganchos para abrir la llamada</div>
                <ul className="list-disc space-y-0.5 pl-5">{p.call_hooks.map((h, i) => <li key={i}>{h}</li>)}</ul>
              </div>
            )}
            <details className="mb-4 rounded-2xl bg-slate-50 p-3.5 text-sm text-slate-700">
              <summary className="cursor-pointer font-medium">Guion para despachos</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>«Hola, ¿hablo con el responsable del despacho? Soy [nombre], de Leads Hunters. Trabajamos solo con despachos de Segunda Oportunidad.»</li>
                <li>«Una pregunta rápida: ¿cuántas consultas de clientes con deudas os entran al mes y quién las llama?»</li>
                <li>Usa un gancho de arriba. «Los leads de deudas se enfrían en minutos: nosotros los llamamos en menos de 5 minutos y os pasamos solo consultas cualificadas (deuda, acreedores, ingresos).»</li>
                <li>«Cobramos 500 € al mes fijos más 30-50 € por cada consulta cualificada que se realiza. Es un servicio de marketing: nunca un porcentaje de vuestros honorarios.»</li>
                <li>Cierre: «¿Os viene bien una videollamada de 15 minutos el [día] para enseñaros cómo funciona?»</li>
              </ol>
            </details>
            <form action={log} className="space-y-3">
              <input type="hidden" name="kind" value="llamada" />
              <textarea name="notes" rows={3} placeholder="Notas: con quién hablaste, objeciones, cuántas consultas reciben…" className={input} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className={label}>Próxima acción (opcional)</span>
                  <input type="datetime-local" name="next_action_at" className={input} />
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm text-slate-600">
                  <input type="checkbox" name="go_next" value="1" defaultChecked={callMode} className="h-4 w-4 rounded border-slate-300" />
                  Pasar al siguiente despacho al guardar
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {outcomes.map(([v, l, cls]) => (
                  <button key={v} name="outcome" value={v} className={cls}>{l}</button>
                ))}
              </div>
            </form>
          </Card>

          {auditLink && msg && (
            <Card title="Auditoría para enviarle">
              <p className="text-sm text-slate-600">
                {p.audit_views > 0 ? (
                  <><span className="font-semibold text-emerald-700">La ha abierto {p.audit_views} {p.audit_views === 1 ? "vez" : "veces"}</span> · última {ago(p.audit_last_view_at)}</>
                ) : (
                  "Todavía no la ha abierto."
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={auditLink} target="_blank" className={btn.secondary}>Ver auditoría ↗</a>
                {waNumber && <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(msg.body)}`} target="_blank" className={btn.success}>Enviar por WhatsApp</a>}
                {p.email && <a href={`mailto:${p.email}?subject=${encodeURIComponent(msg.subject)}&body=${encodeURIComponent(msg.body)}`} className={btn.secondary}>Enviar por email</a>}
              </div>
              <details className="mt-3 text-sm text-slate-600">
                <summary className="cursor-pointer font-medium">Ver el mensaje</summary>
                <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-slate-50 p-3">{msg.body}</p>
              </details>
              <p className="mt-3 text-xs text-slate-400">Envíala después de hablar con ellos y con su permiso (la ley prohíbe el email comercial no solicitado). Te avisamos por WhatsApp cuando la abran.</p>
            </Card>
          )}

          <Card title={`Por qué tiene ${p.score} puntos`}>
            <div className="space-y-2">
              {p.score_breakdown.map((l, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-28 shrink-0 font-medium text-slate-700 sm:w-40">{l.criterio}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blaze" style={{ width: `${(l.puntos / l.max) * 100}%` }} />
                  </div>
                  <div className="w-14 text-right tabular-nums text-slate-600">{l.puntos}/{l.max}</div>
                  <div className="hidden w-72 truncate text-xs text-slate-500 md:block" title={l.detalle}>{l.detalle}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Historial">
            {acts.length === 0 ? (
              <p className="text-sm text-slate-500">Todavía no hay actividad.</p>
            ) : (
              <ul className="space-y-3">
                {acts.map((a) => (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <div className="w-28 shrink-0 text-xs text-slate-500">{dateTime(a.created_at)}</div>
                    <div>
                      <span className="font-medium text-slate-800">{ACTIVITY_KIND[a.kind] ?? a.kind}</span>
                      {a.outcome && <span className="text-slate-600"> · {PROSPECT_STATUS[a.outcome]?.label ?? a.outcome.replace(/_/g, " ")}</span>}
                      {a.user_name && <span className="text-xs text-slate-400"> · {a.user_name}</span>}
                      {a.notes && <p className="mt-0.5 whitespace-pre-wrap text-slate-600">{a.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:space-y-6">
          <Card title="Contacto">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-slate-500">Teléfono</dt><dd>{p.phone ? <a className="text-indigo-600" href={telHref(p.phone)}>{p.phone}</a> : "—"}{p.phone && <a className="ml-2 text-xs text-emerald-600" href={waHref(p.phone)} target="_blank">WhatsApp</a>}</dd></div>
              <div><dt className="text-xs text-slate-500">Email</dt><dd>{p.email ? <a className="text-indigo-600" href={`mailto:${p.email}`}>{p.email}</a> : "—"}</dd></div>
              <div><dt className="text-xs text-slate-500">Web</dt><dd className="truncate">{p.website ? <a className="text-indigo-600" href={p.website} target="_blank">{p.website.replace(/^https?:\/\//, "")}</a> : "—"}</dd></div>
              <div><dt className="text-xs text-slate-500">Dirección</dt><dd>{p.address ?? "—"}</dd></div>
              <div><dt className="text-xs text-slate-500">Google</dt><dd>{p.rating ?? "—"}★ · {p.reviews_count ?? 0} reseñas {p.google_maps_url && <a className="ml-1 text-indigo-600" href={p.google_maps_url} target="_blank">Ver ficha</a>}</dd></div>
              <div className="flex flex-wrap gap-2 pt-1">
                {p.instagram && <a href={p.instagram.startsWith("http") ? p.instagram : `https://instagram.com/${p.instagram}`} target="_blank"><Badge tone="fuchsia">Instagram{p.instagram_followers != null ? ` · ${p.instagram_followers}` : ""}</Badge></a>}
                {p.facebook && <a href={p.facebook} target="_blank"><Badge tone="blue">Facebook</Badge></a>}
                {p.linkedin && <a href={p.linkedin} target="_blank"><Badge tone="indigo">LinkedIn</Badge></a>}
                {p.tiktok && <a href={p.tiktok} target="_blank"><Badge>TikTok</Badge></a>}
                {p.youtube && <a href={p.youtube} target="_blank"><Badge tone="rose">YouTube</Badge></a>}
              </div>
            </dl>
          </Card>

          <Card title="Señales de marketing" actions={p.website ? <form action={analyzeWebsite.bind(null, id)}><button className={btn.ghost}>↻ Analizar web</button></form> : null}>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-500">Web habla de LSO</dt><dd>{yn(p.website_mentions_lso)}</dd>
              <dt className="text-slate-500">Formulario</dt><dd>{yn(p.website_has_form)}</dd>
              <dt className="text-slate-500">WhatsApp</dt><dd>{yn(p.website_has_whatsapp)}</dd>
              <dt className="text-slate-500">Píxel de anuncios</dt><dd>{yn(p.website_has_pixel)}</dd>
              <dt className="text-slate-500">Anuncia en Meta</dt><dd>{yn(p.meta_ads_active)}{p.meta_ads_count ? ` (${p.meta_ads_count})` : ""}</dd>
              <dt className="text-slate-500">IG sin publicar</dt><dd>{p.instagram_days_since_post != null ? `${p.instagram_days_since_post} días` : "—"}</dd>
            </dl>
            <p className="mt-2 text-xs text-slate-400">Analizado {ago(p.enriched_at)}</p>
            <form action={setMetaAds.bind(null, id)} className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <a href={adLibrary} target="_blank" className="text-xs font-medium text-indigo-600">Abrir Biblioteca de anuncios de Meta ↗</a>
              <div className="flex gap-2">
                <select name="meta_ads" defaultValue={p.meta_ads_active == null ? "" : p.meta_ads_lso ? "si_lso" : p.meta_ads_active ? "si" : "no"} className={input}>
                  <option value="" disabled>¿Anuncia?</option>
                  <option value="no">No anuncia</option>
                  <option value="si">Sí, otros temas</option>
                  <option value="si_lso">Sí, deudas / LSO</option>
                </select>
                <input name="meta_ads_count" type="number" min={0} placeholder="Nº" defaultValue={p.meta_ads_count ?? ""} className={`${input} w-20`} />
                <button className={btn.secondary}>OK</button>
              </div>
            </form>
          </Card>

          <Card title="Estado">
            <form action={updateProspectStatus.bind(null, id)} className="space-y-2">
              <select name="status" defaultValue={p.status} className={input}>
                {Object.entries(PROSPECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <input type="datetime-local" name="next_action_at" defaultValue={p.next_action_at ? toLocalInput(new Date(p.next_action_at)) : toLocalInput(tomorrow)} className={input} />
              <button className={`${btn.secondary} w-full`}>Guardar estado</button>
            </form>
          </Card>

          <Card title="Notas">
            <form action={saveProspectNotes.bind(null, id)} className="space-y-2">
              <textarea name="notes" rows={5} defaultValue={p.notes ?? ""} className={input} />
              <button className={`${btn.secondary} w-full`}>Guardar notas</button>
            </form>
            <p className="mt-3 text-xs text-slate-400">
              Origen: {p.source}{p.search_term ? ` · «${p.search_term}»` : ""} · alta {dateTime(p.created_at)}
            </p>
          </Card>
          <A href="/prospeccion" className="text-sm">← Volver al listado</A>
        </div>
      </div>
    </>
  );
}
