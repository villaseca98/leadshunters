// Leads Hunters es la matriz: aquí se dan de alta las empresas (Recorta…) y sus líneas de negocio.
import Link from "next/link";
import { query } from "@/lib/db";
import { eur } from "@/lib/format";
import { Card, Field, PageHeader, btn, input } from "@/components/ui";
import { createCompany, createLine, updateCompany } from "./actions";

export default async function Negocios(props: PageProps<"/negocios">) {
  const sp = await props.searchParams;
  const companies = await query<{ id: string; slug: string; name: string; website: string | null; notes: string | null; active: boolean }>(
    "SELECT id, slug, name, website, notes, active FROM companies ORDER BY name = 'Leads Hunters' DESC, name",
  );
  const lines = await query<{
    id: string; company_id: string; slug: string; name: string; emoji: string; kind: string; active: boolean; fields: unknown[];
    leads_mes: number; abiertos: number; ganados_mes: number; valor_mes: number | null;
  }>(
    `SELECT bl.id, bl.company_id, bl.slug, bl.name, bl.emoji, bl.kind, bl.active, bl.fields,
       CASE WHEN bl.kind = 'despachos' THEN (SELECT count(*) FROM leads WHERE created_at >= date_trunc('month', now()))::int
            ELSE (SELECT count(*) FROM line_leads WHERE line_id = bl.id AND created_at >= date_trunc('month', now()))::int END leads_mes,
       (SELECT count(*) FROM line_leads WHERE line_id = bl.id AND status IN ('nuevo','no_contesta','contactado','propuesta'))::int abiertos,
       (SELECT count(*) FROM line_leads WHERE line_id = bl.id AND won_at >= date_trunc('month', now()))::int ganados_mes,
       (SELECT sum(value) FROM line_leads WHERE line_id = bl.id AND won_at >= date_trunc('month', now())) valor_mes
     FROM business_lines bl ORDER BY bl.position, bl.name`,
  );
  const error = typeof sp.error === "string" ? sp.error : "";

  return (
    <>
      <PageHeader
        title="Empresas y líneas"
        eyebrow="Leads Hunters · matriz"
        subtitle="Cada empresa tiene sus líneas de negocio, con sus preguntas y su prioridad. Todos los leads de Instagram entran aquí, clasificados."
      />
      {error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      <div className="space-y-4">
        {companies.map((c) => (
          <Card
            key={c.id}
            title={<span className="text-ink">{c.name}{!c.active && " · pausada"}</span>}
            actions={c.website ? <a href={c.website} target="_blank" className="text-xs font-semibold text-indigo-600">{c.website.replace(/^https?:\/\//, "")}</a> : null}
          >
            {c.notes && <p className="mb-3 text-sm text-slate-500">{c.notes}</p>}
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lines.filter((l) => l.company_id === c.id).map((l) => (
                <li key={l.id}>
                  <Link
                    href={l.kind === "despachos" ? "/leads" : `/negocios/${l.id}`}
                    className={`block h-full rounded-2xl border p-3.5 hover:border-slate-400 ${l.active ? "border-slate-200 bg-white" : "border-dashed border-slate-300 bg-slate-50 opacity-70"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{l.emoji} {l.name}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">linea: {l.slug}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {l.kind === "despachos"
                        ? `Integrada (test de deudas, cola, consultas y facturación) · ${l.leads_mes} leads este mes`
                        : `${l.fields.length} preguntas · ${l.leads_mes} leads este mes · ${l.abiertos} abiertos · ${l.ganados_mes} cierres${l.valor_mes ? ` (${eur(l.valor_mes)})` : ""}`}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-600">Editar empresa</summary>
              <form action={updateCompany.bind(null, c.id)} className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Nombre"><input name="name" defaultValue={c.name} className={input} /></Field>
                <Field label="Web"><input name="website" defaultValue={c.website ?? ""} className={input} /></Field>
                <div className="sm:col-span-2"><Field label="Notas"><input name="notes" defaultValue={c.notes ?? ""} className={input} /></Field></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={c.active} /> Activa</label>
                <div><button className={btn.secondary}>Guardar empresa</button></div>
              </form>
            </details>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Nueva línea de negocio">
          <form action={createLine} className="grid gap-3 sm:grid-cols-2">
            <Field label="Empresa">
              <select name="company_id" className={input}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </Field>
            <Field label="Nombre" hint="Por ejemplo: Alarmas, Seguros de coche, Fibra"><input name="name" required className={input} /></Field>
            <Field label="Emoji"><input name="emoji" placeholder="🔔" className={input} /></Field>
            <Field label="Código para ManyChat (opcional)" hint="Se crea solo a partir del nombre"><input name="slug" className={input} /></Field>
            <div className="sm:col-span-2"><button className={btn.primary}>Crear y poner sus preguntas</button></div>
          </form>
        </Card>
        <Card title="Nueva empresa">
          <form action={createCompany} className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre"><input name="name" required className={input} /></Field>
            <Field label="Web"><input name="website" placeholder="https://…" className={input} /></Field>
            <div className="sm:col-span-2"><button className={btn.secondary}>Crear empresa</button></div>
          </form>
        </Card>
      </div>
    </>
  );
}
