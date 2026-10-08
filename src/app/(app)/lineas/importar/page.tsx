// Reactivación: subir contactos antiguos (que ya dieron su permiso) a una línea para volver a llamarlos.
import { getLines } from "@/lib/services/lines";
import { Card, Field, PageHeader, btn, input } from "@/components/ui";
import { importLineCsv } from "../actions";

export default async function ImportarLinea(props: PageProps<"/lineas/importar">) {
  const sp = await props.searchParams;
  const lines = await getLines({ includeDespachos: false });
  const error = typeof sp.error === "string" ? sp.error : "";
  return (
    <>
      <PageHeader title="Reactivar contactos antiguos" subtitle="Sube un CSV de personas que ya te dieron su permiso. Entran en la cola detrás de los leads nuevos y sin aviso por WhatsApp." />
      <Card>
        {error && <p className="mb-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <form action={importLineCsv} className="grid max-w-2xl gap-3">
          <Field label="Línea">
            <select name="line_id" className={input}>{lines.map((l) => <option key={l.id} value={l.id}>{l.emoji} {l.name} · {l.company_name}</option>)}</select>
          </Field>
          <Field label="Archivo CSV" hint="Columnas: nombre, telefono, y si las tienes provincia, email y las preguntas de la línea (por ejemplo factura). Lo demás se guarda también.">
            <input type="file" name="file" accept=".csv,text/csv" required className={input} />
          </Field>
          <Field label="Campaña"><input name="campaign" defaultValue="reactivacion" className={input} /></Field>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" name="consent" className="mt-1" />
            <span>Estas personas me dieron su permiso para contactarles y no se han dado de baja.</span>
          </label>
          <div><button className={btn.primary}>Importar</button></div>
        </form>
      </Card>
    </>
  );
}
