import Link from "next/link";
import { query } from "@/lib/db";
import { PROSPECT_STATUS } from "@/lib/labels";
import { PROVINCES } from "@/lib/normalize";
import { ago } from "@/lib/format";
import { A, Badge, Empty, Filters, PageHeader, Pager, ScorePill, StatusBadge, Table, Td, btn, input } from "@/components/ui";

const PER_PAGE = 50;

export default async function Prospeccion(props: PageProps<"/prospeccion">) {
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = str("q"), status = str("status"), tier = str("tier"), province = str("province"), sort = str("sort") || "score";
  const page = Math.max(1, Number(str("page") || 1));

  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace("?", `$${params.length}`)); };
  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(`(name ILIKE $${i} OR city ILIKE $${i} OR phone ILIKE $${i})`);
  }
  if (status) add("status = ?", status);
  else where.push("status <> 'descartado'");
  if (tier) add("score_tier = ?", tier);
  if (province) add("province = ?", province);
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const order = sort === "recientes" ? "created_at DESC" : sort === "nombre" ? "name" : sort === "resenas" ? "reviews_count DESC NULLS LAST" : "score DESC, reviews_count DESC NULLS LAST";

  const [{ total }] = await query<{ total: number }>(`SELECT count(*)::int AS total FROM prospects ${w}`, params);
  const rows = await query<{
    id: string; name: string; city: string | null; province: string | null; phone: string | null; website: string | null;
    rating: number | null; reviews_count: number | null; score: number; score_tier: string; status: string;
    meta_ads_active: boolean | null; website_mentions_lso: boolean | null; instagram: string | null; next_action_at: string | null; enriched_at: string | null;
  }>(
    `SELECT id, name, city, province, phone, website, rating, reviews_count, score, score_tier, status, meta_ads_active,
            website_mentions_lso, instagram, next_action_at, enriched_at
       FROM prospects ${w} ORDER BY ${order} LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`,
    params,
  );
  const tiers = await query<{ score_tier: string; n: number }>("SELECT score_tier, count(*)::int n FROM prospects WHERE status <> 'descartado' GROUP BY 1");
  const t = Object.fromEntries(tiers.map((x) => [x.score_tier, x.n]));

  const href = (p: number) => {
    const u = new URLSearchParams(Object.entries({ q, status, tier, province, sort }).filter(([, v]) => v) as [string, string][]);
    u.set("page", String(p));
    return `/prospeccion?${u}`;
  };

  return (
    <>
      <PageHeader
        title="Despachos"
        eyebrow="Prospección"
        subtitle={`${total} despachos · A: ${t.A ?? 0} · B: ${t.B ?? 0} · C: ${t.C ?? 0}`}
        actions={
          <>
            <Link href="/prospeccion/importar" className={btn.secondary}>Importar / añadir</Link>
            <a href="/api/export/prospects" className={btn.secondary}>Exportar CSV</a>
            <Link href="/prospeccion/llamar" className={btn.hunt}>Llamar al siguiente</Link>
          </>
        }
      />

      <Filters active={[status, tier, province].filter(Boolean).length}>
      <form className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <input name="q" defaultValue={q} placeholder="Buscar nombre, ciudad, teléfono…" className={`${input} col-span-2`} />
        <select name="status" defaultValue={status} className={input}>
          <option value="">Estado: todos (sin descartados)</option>
          {Object.entries(PROSPECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select name="tier" defaultValue={tier} className={input}>
          <option value="">Prioridad: todas</option>
          <option value="A">A (≥70)</option>
          <option value="B">B (45-69)</option>
          <option value="C">C (&lt;45)</option>
        </select>
        <select name="province" defaultValue={province} className={input}>
          <option value="">Provincia: todas</option>
          {PROVINCES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <div className="flex gap-2">
          <select name="sort" defaultValue={sort} className={input}>
            <option value="score">Orden: puntuación</option>
            <option value="recientes">Más recientes</option>
            <option value="resenas">Más reseñas</option>
            <option value="nombre">Nombre</option>
          </select>
          <button className={btn.secondary}>Filtrar</button>
        </div>
      </form>
      </Filters>

      {rows.length === 0 ? (
        <Empty>
          No hay despachos con estos filtros. Lanza el flujo <b>01 · Prospección Google Maps</b> en n8n o{" "}
          <A href="/prospeccion/importar">importa un archivo de Apify</A>.
        </Empty>
      ) : (
        <Table head={["Despacho", "Ubicación", "Google", "Señales", "Estado", "Próxima acción"]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50">
              <Td primary className="max-w-sm">
                <div className="flex items-center gap-3">
                  <ScorePill score={r.score} tier={r.score_tier} />
                  <div className="min-w-0">
                    <A href={`/prospeccion/${r.id}`} className="block md:truncate">{r.name}</A>
                    <div className="text-xs text-slate-500">{r.phone ?? "sin teléfono"}</div>
                  </div>
                </div>
              </Td>
              <Td>{r.city ?? "—"}<div className="text-xs text-slate-500 max-md:hidden">{r.province}</div></Td>
              <Td hide>{r.rating ? `${r.rating}★` : "—"} <span className="text-xs text-slate-500">({r.reviews_count ?? 0})</span></Td>
              <Td wide>
                <div className="flex flex-wrap gap-1">
                  {r.website_mentions_lso && <Badge tone="emerald">LSO</Badge>}
                  {r.meta_ads_active && <Badge tone="violet">Anuncia</Badge>}
                  {!r.website && <Badge tone="amber">Sin web</Badge>}
                  {!r.instagram && <Badge tone="slate">Sin IG</Badge>}
                  {!r.enriched_at && <Badge tone="slate">Sin analizar</Badge>}
                </div>
              </Td>
              <Td><StatusBadge map={PROSPECT_STATUS} value={r.status} /></Td>
              <Td hide className="text-xs">{r.next_action_at ? ago(r.next_action_at) : "—"}</Td>
            </tr>
          ))}
        </Table>
      )}
      <Pager page={page} pages={Math.ceil(total / PER_PAGE)} makeHref={href} />
    </>
  );
}
