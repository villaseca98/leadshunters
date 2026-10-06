import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { appUrl } from "@/lib/appUrl";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/format";
import { KIND_LABEL, postsForMonth, type PostKind } from "@/lib/socialPosts";
import { A, Badge, ChipLink, Empty, PageHeader, btn } from "@/components/ui";

type Post = { id: string; position: number; template: PostKind; title: string; slides: string[]; caption: string; status: string };

async function generate(clientId: string, month: string) {
  "use server";
  await requireUser();
  const c = await queryOne<{ name: string; city: string | null; provinces: string[]; test_code: string | null }>(
    "SELECT name, city, provinces, test_code FROM clients WHERE id = $1", [clientId]);
  if (!c || !/^\d{4}-\d{2}$/.test(month)) return;
  const link = c.test_code ? `${appUrl()}/test/${c.test_code}?utm_source=instagram&utm_campaign=organico` : "el enlace de la bio";
  const ideas = postsForMonth(month, { firm: c.name, place: c.city ?? c.provinces[0] ?? "", link });
  for (const [i, p] of ideas.entries()) {
    await query(
      `INSERT INTO social_posts(client_id, month, position, template, title, slides, caption) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (client_id, month, position) DO NOTHING`,
      [clientId, month, i + 1, p.kind, p.title, JSON.stringify(p.slides), p.caption],
    );
  }
  revalidatePath(`/clientes/${clientId}/publicaciones`);
}

async function toggle(clientId: string, id: string, status: string) {
  "use server";
  await requireUser();
  await query("UPDATE social_posts SET status = $3 WHERE id = $1 AND client_id = $2", [id, clientId, status === "publicado" ? "borrador" : "publicado"]);
  revalidatePath(`/clientes/${clientId}/publicaciones`);
}

export default async function Publicaciones(props: PageProps<"/clientes/[id]/publicaciones">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await queryOne<{ name: string }>("SELECT name FROM clients WHERE id = $1", [id]);
  if (!c) notFound();
  const now = currentMonth();
  const month = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : now;
  const posts = await query<Post>("SELECT id, position, template, title, slides, caption, status FROM social_posts WHERE client_id = $1 AND month = $2 ORDER BY position", [id, month]);
  const done = posts.filter((p) => p.status === "publicado").length;

  return (
    <>
      <PageHeader
        title="Publicaciones de Instagram"
        eyebrow={c.name}
        subtitle={`12 publicaciones al mes para su perfil (planes Completo y Premium). ${posts.length ? `${done} de ${posts.length} publicadas.` : ""}`}
        actions={<A href={`/clientes/${id}`}>← Ficha</A>}
      />
      <div className="lh-rail -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {[-1, 0, 1].map((d) => {
          const m = shiftMonth(now, d);
          return <ChipLink key={m} href={`/clientes/${id}/publicaciones?mes=${m}`} active={m === month}><span className="first-letter:uppercase">{monthLabel(m)}</span></ChipLink>;
        })}
      </div>
      {posts.length === 0 ? (
        <Empty>
          <p>Todavía no hay publicaciones para {monthLabel(month)}.</p>
          <form action={generate.bind(null, id, month)} className="mt-4"><button className={btn.hunt}>Generar las 12 publicaciones</button></form>
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {posts.map((p) => (
            <article key={p.id} className="min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <span className="num grid size-8 place-items-center rounded-full bg-ink text-xs font-semibold text-white">{p.position}</span>
                <Badge tone={p.template === "reel" ? "violet" : p.template === "historia" ? "amber" : "blue"}>{KIND_LABEL[p.template]}</Badge>
                {p.status === "publicado" && <Badge tone="emerald">Publicada</Badge>}
                <form action={toggle.bind(null, id, p.id, p.status)} className="ml-auto">
                  <button className={btn.ghost}>{p.status === "publicado" ? "Desmarcar" : "Marcar publicada"}</button>
                </form>
              </div>
              <h3 className="mt-3 font-semibold">{p.title}</h3>
              <div className="lh-rail -mx-4 mt-3 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1">
                {p.slides.map((s, i) => (
                  <div key={i} className={`grid aspect-square w-44 shrink-0 snap-start place-items-center rounded-2xl p-4 text-center text-sm font-semibold leading-snug ${i === 0 ? "bg-ink text-white" : i === p.slides.length - 1 ? "bg-blaze text-blaze-ink" : "bg-paper text-ink ring-1 ring-slate-200"}`}>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-indigo-700">Texto de la publicación</summary>
                <pre className="mt-2 select-all whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-[13px] leading-relaxed text-slate-700">{p.caption}</pre>
              </details>
            </article>
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-slate-500">Textos informativos: no prometen resultados. Revísalos con el despacho antes de publicar; los testimonios solo con permiso escrito del cliente.</p>
    </>
  );
}
