// Ajustes de una línea: preguntas, puntos de prioridad, textos y lo que hay que pegar en ManyChat.
import { notFound } from "next/navigation";
import { appUrl } from "@/lib/appUrl";
import { query } from "@/lib/db";
import { manychatBody, optionsText, type LineField } from "@/lib/lineas";
import { getLine } from "@/lib/services/lines";
import { A, Card, Field, PageHeader, btn, input } from "@/components/ui";
import { updateLine } from "../actions";

const TYPES: Record<LineField["type"], string> = { select: "Botones", bool: "Sí / No", number: "Número", text: "Texto libre" };

export default async function LineaAjustes(props: PageProps<"/negocios/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const line = await getLine(id);
  if (!line || line.kind === "despachos") notFound();
  const companies = await query<{ id: string; name: string }>("SELECT id, name FROM companies ORDER BY name");
  const rows: (LineField | null)[] = [...line.fields, ...Array(3).fill(null)].slice(0, 12);
  const url = `${appUrl() || "https://leadshunters-nrfo.vercel.app"}/api/v1/particulares`;

  return (
    <>
      <PageHeader
        title={`${line.emoji} ${line.name}`}
        eyebrow={line.company_name}
        subtitle={<>Código para ManyChat: <code className="rounded bg-slate-100 px-1.5 font-mono">{line.slug}</code> · <A href={`/lineas?linea=${line.slug}`}>ver sus leads</A></>}
      />
      {sp.nueva && <Card className="mb-4"><p className="text-sm">Línea creada. Pon sus preguntas abajo y guarda; luego copia el bloque de ManyChat.</p></Card>}
      {sp.guardado && <Card className="mb-4"><p className="text-sm text-emerald-700">Guardado. La prioridad de los leads abiertos se ha recalculado.</p></Card>}

      <form action={updateLine.bind(null, id)} className="space-y-4">
        <Card title="Línea">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nombre"><input name="name" defaultValue={line.name} className={input} /></Field>
            <Field label="Emoji"><input name="emoji" defaultValue={line.emoji} className={input} /></Field>
            <Field label="Empresa">
              <select name="company_id" defaultValue={line.company_id} className={input}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </Field>
            <div className="sm:col-span-3">
              <Field label="Palabras clave" hint="Separadas por comas. Si ManyChat manda una de estas en «linea», el lead cae aquí (por ejemplo: luz, factura, electricidad).">
                <input name="keywords" defaultValue={line.keywords.join(", ")} className={input} />
              </Field>
            </div>
            <Field label="Nombre del paso «propuesta»"><input name="proposal_label" defaultValue={line.proposal_label} className={input} /></Field>
            <Field label="Nombre del cierre"><input name="won_label" defaultValue={line.won_label} className={input} /></Field>
            <Field label="Lo que cobras al cerrar se llama"><input name="value_label" defaultValue={line.value_label} className={input} /></Field>
            <Field label="Importe habitual por cierre (€)" hint="Se propone solo al marcar un cierre"><input name="default_value" inputMode="decimal" defaultValue={line.default_value ?? ""} className={input} /></Field>
            <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="active" defaultChecked={line.active} /> Activa (recibe leads)</label>
          </div>
        </Card>

        <Card title="Preguntas y prioridad">
          <p className="mb-3 text-sm text-slate-500">
            Cada respuesta puede sumar o restar puntos. Opciones separadas por comas, con sus puntos tras «=»: <code className="font-mono">Casa o chalet=2, Piso=-5</code>.
            Con {line.priority_a} puntos o más el lead es prioridad A; con {line.priority_b} o más, B; por debajo, C.
          </p>
          <div className="space-y-3">
            {rows.map((f, i) => (
              <div key={i} className="grid gap-2 rounded-2xl bg-slate-50 p-3 sm:grid-cols-12">
                <div className="sm:col-span-4"><Field label={`Pregunta ${i + 1}`}><input name={`label_${i}`} defaultValue={f?.label ?? ""} placeholder="¿Cuánto pagas de luz al mes?" className={input} /></Field></div>
                <div className="sm:col-span-2">
                  <Field label="Tipo">
                    <select name={`type_${i}`} defaultValue={f?.type ?? "select"} className={input}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </Field>
                </div>
                <div className="sm:col-span-4"><Field label="Opciones (Botones)"><input name={`options_${i}`} defaultValue={optionsText(f?.options)} className={input} /></Field></div>
                <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                  <Field label="Sí ="><input name={`yes_${i}`} defaultValue={f?.points_yes ?? ""} inputMode="numeric" className={input} /></Field>
                  <Field label="No ="><input name={`no_${i}`} defaultValue={f?.points_no ?? ""} inputMode="numeric" className={input} /></Field>
                </div>
                <div className="sm:col-span-4"><Field label="Campo en ManyChat"><input name={`key_${i}`} defaultValue={f?.key ?? ""} placeholder="se crea solo" className={`${input} font-mono`} /></Field></div>
                <div className="sm:col-span-8"><Field label="Otros nombres que acepta (comas)"><input name={`aliases_${i}`} defaultValue={f?.aliases?.join(", ") ?? ""} className={input} /></Field></div>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Puntos para prioridad A"><input name="priority_a" inputMode="numeric" defaultValue={line.priority_a} className={input} /></Field>
            <Field label="Puntos para prioridad B"><input name="priority_b" inputMode="numeric" defaultValue={line.priority_b} className={input} /></Field>
          </div>
        </Card>

        <Card title="Textos">
          <div className="grid gap-3">
            <Field label="Consentimiento (botón «Acepto» de ManyChat)" hint="Que lo revise el abogado."><textarea name="consent_text" rows={2} defaultValue={line.consent_text} className={input} /></Field>
            <Field label="Mensaje de gracias que devuelve la app"><textarea name="thanks_text" rows={2} defaultValue={line.thanks_text} className={input} /></Field>
          </div>
        </Card>
        <button className={btn.primary}>Guardar línea</button>
      </form>

      <Card title="Para ManyChat" className="mt-4">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>Automatización con la palabra clave <b>{line.slug.toUpperCase()}</b> (comentario en reel o post y respuesta a historia).</li>
          <li>
            Preguntas con botones, guardando cada respuesta en su campo:
            <ul className="mt-1 list-disc pl-5">
              {line.fields.map((f) => (
                <li key={f.key}><code className="font-mono">{f.key}</code>: {f.label}{f.type === "select" ? ` → ${f.options?.map((o) => o.label).join(" · ")}` : f.type === "bool" ? " → Sí · No" : ""}</li>
              ))}
              <li><code className="font-mono">provincia</code> y <code className="font-mono">telefono</code> (texto libre)</li>
            </ul>
          </li>
          <li>Botón «Acepto» con este texto: <i>{line.consent_text}</i></li>
          <li>
            <b>External Request</b> · POST · <code className="break-all font-mono">{url}</code> · cabeceras <code className="font-mono">x-api-key</code> (Ajustes → Clave de la API) y <code className="font-mono">content-type: application/json</code>. Cuerpo:
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-slate-50 p-3 font-mono text-xs ring-1 ring-inset ring-slate-200">{manychatBody(line)}</pre>
          </li>
          <li>Cambia <code className="font-mono">campana</code> por el nombre del reel o anuncio. En <b>Response mapping</b> guarda <code className="font-mono">$.titulo</code> y <code className="font-mono">$.texto</code> y envíalos como último mensaje.</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">Cualquier otro campo que mandes se guarda también en el lead. Si la web de la empresa tiene formulario, puede mandar lo mismo con <code className="font-mono">&quot;canal&quot;: &quot;web&quot;</code>.</p>
      </Card>
    </>
  );
}
