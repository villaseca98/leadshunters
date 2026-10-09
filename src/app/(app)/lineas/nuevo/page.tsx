import Link from "next/link";
import { getLines } from "@/lib/services/lines";
import { Card, Field, PageHeader, btn, input } from "@/components/ui";
import { createLineLead } from "../actions";

export default async function NuevoLeadLinea(props: PageProps<"/lineas/nuevo">) {
  const sp = await props.searchParams;
  const lines = await getLines({ includeDespachos: false });
  const line = lines.find((l) => l.slug === sp.linea) ?? lines[0];
  const error = typeof sp.error === "string" ? sp.error : "";
  if (!line) return <PageHeader title="Lead manual" subtitle="Primero crea una línea en Grupo y empresas." />;
  return (
    <>
      <PageHeader title="Lead manual" subtitle="Para quien te escribe por Instagram o WhatsApp y te da sus datos. Solo con su permiso." />
      <div className="lh-rail -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {lines.map((l) => (
          <Link key={l.id} href={`/lineas/nuevo?linea=${l.slug}`} className={l.id === line.id ? btn.primary : btn.secondary}>{l.emoji} {l.name}</Link>
        ))}
      </div>
      <Card title={`${line.emoji} ${line.name} · ${line.company_name}`}>
        {error && <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <form action={createLineLead} className="grid max-w-3xl gap-3 sm:grid-cols-2">
          <input type="hidden" name="line_id" value={line.id} />
          <Field label="Nombre *"><input name="full_name" required className={input} /></Field>
          <Field label="Teléfono *"><input name="phone" required className={input} /></Field>
          <Field label="Email"><input name="email" type="email" className={input} /></Field>
          <Field label="Provincia"><input name="province" className={input} /></Field>
          {line.fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.type === "select" ? (
                <select name={`f_${f.key}`} className={input}><option value="">—</option>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
              ) : f.type === "bool" ? (
                <select name={`f_${f.key}`} className={input}><option value="">—</option><option value="si">Sí</option><option value="no">No</option></select>
              ) : (
                <input name={`f_${f.key}`} inputMode={f.type === "number" ? "decimal" : undefined} className={input} />
              )}
            </Field>
          ))}
          <Field label="Canal">
            <select name="channel" className={input}><option value="instagram">Instagram</option><option value="whatsapp">WhatsApp</option><option value="manual">Otro</option></select>
          </Field>
          <Field label="Campaña o reel"><input name="campaign" className={input} /></Field>
          <div className="sm:col-span-2"><Field label="Notas"><textarea name="notes" rows={2} className={input} /></Field></div>
          <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" name="consent" required className="mt-1" />
            <span>Me ha dado permiso para llamarle: «{line.consent_text}»</span>
          </label>
          <div className="sm:col-span-2"><button className={btn.primary}>Crear lead</button></div>
        </form>
      </Card>
    </>
  );
}
