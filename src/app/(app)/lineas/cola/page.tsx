// Cola de llamadas de las demás líneas: igual que «Cazar» de los despachos, prioridad A primero y rellamadas con la misma cadencia.
import { getLines, queueCounts } from "@/lib/services/lines";
import { Card, Empty, PageHeader, btn } from "@/components/ui";
import { takeNextLineLead } from "../actions";

export default async function ColaLineas(props: PageProps<"/lineas/cola">) {
  const sp = await props.searchParams;
  const lines = await getLines({ includeDespachos: false });
  const counts = Object.fromEntries((await queueCounts()).map((c) => [c.line_id, c.n]));
  const total = lines.reduce((a, l) => a + (counts[l.id] ?? 0), 0);
  const selected = typeof sp.linea === "string" ? sp.linea : "";
  return (
    <>
      <PageHeader title="Cazar: otras líneas" eyebrow="Cola de llamadas" subtitle="Prioridad A primero. Al guardar el resultado salta al siguiente. Los «no contesta» vuelven solos a la cola." />
      {sp.vacia && <Card className="mb-4"><p className="text-sm">No queda nadie por llamar {selected ? "en esta línea" : ""} ahora mismo. Buen trabajo.</p></Card>}
      {total === 0 ? (
        <Empty>Nadie esperando llamada.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <form action={takeNextLineLead} className="rounded-[var(--radius-card)] bg-ink p-5 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Todas las líneas</div>
            <div className="num mt-2 text-5xl font-semibold text-blaze">{total}</div>
            <button className={`${btn.hunt} mt-4 w-full`}>Coger el siguiente</button>
          </form>
          {lines.filter((l) => counts[l.id]).map((l) => (
            <form key={l.id} action={takeNextLineLead} className={`rounded-[var(--radius-card)] border bg-white p-5 ${selected === l.slug ? "border-blaze" : "border-slate-200"}`}>
              <input type="hidden" name="linea" value={l.slug} />
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{l.company_name}</div>
              <div className="mt-1 font-semibold">{l.emoji} {l.name}</div>
              <div className="num mt-2 text-4xl font-semibold">{counts[l.id]}</div>
              <button className={`${btn.primary} mt-4 w-full`}>Coger el siguiente</button>
            </form>
          ))}
        </div>
      )}
    </>
  );
}
