import { createProspect } from "../actions";
import { Card, Field, PageHeader, btn, input } from "@/components/ui";
import { ImportForm } from "./ImportForm";

export default function Importar() {
  return (
    <>
      <PageHeader title="Importar o añadir despachos" subtitle="Lo normal es que lleguen solos desde n8n; esto es para cargas manuales." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Importar archivo">
          <p className="mb-4 text-sm text-slate-600">
            Sube el JSON que exporta el actor <b>Google Maps Scraper</b> de Apify, o un CSV con columnas como
            <code className="mx-1 rounded bg-slate-100 px-1">nombre, telefono, web, ciudad, valoracion, reseñas</code>.
            Se quitan duplicados y negocios cerrados, y cada despacho se puntúa al entrar.
          </p>
          <ImportForm />
        </Card>
        <Card title="Añadir un despacho a mano">
          <form action={createProspect} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Nombre *"><input name="name" required className={input} /></Field></div>
            <Field label="Teléfono"><input name="phone" className={input} /></Field>
            <Field label="Email"><input name="email" type="email" className={input} /></Field>
            <Field label="Web"><input name="website" className={input} placeholder="https://" /></Field>
            <Field label="Ciudad"><input name="city" className={input} /></Field>
            <div className="sm:col-span-2"><Field label="Categoría"><input name="category" defaultValue="Abogado especialista en Segunda Oportunidad" className={input} /></Field></div>
            <div className="sm:col-span-2"><button className={btn.primary}>Añadir y puntuar</button></div>
          </form>
        </Card>
      </div>
    </>
  );
}
