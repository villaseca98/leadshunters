import type { Metadata } from "next";
import { Card, Checklist, ClosingCta, PageTitle, Source } from "@/components/web/Site";

export const metadata: Metadata = {
  title: "Qué deudas se pueden cancelar con la Ley de Segunda Oportunidad",
  description: "Qué deudas cancela la Ley de Segunda Oportunidad, cuáles no, y cuánto se cancela de Hacienda y la Seguridad Social.",
};

export default function Deudas() {
  return (
    <>
      <PageTitle eyebrow="Deudas" title="Qué deudas se pueden cancelar y cuáles no" intro="La ley cancela casi todo lo que no puedes pagar, pero protege algunas deudas. Mejor saberlo desde el principio." />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-semibold">Sí, normalmente</h2>
          <div className="mt-4">
            <Checklist items={[
              "Préstamos personales y tarjetas de crédito",
              "Créditos revolving y microcréditos",
              "Descubiertos bancarios",
              "Deudas con proveedores, alquileres atrasados y suministros",
              "Avales personales que firmaste para una empresa o para otra persona",
              "La parte de una hipoteca que no cubra el valor de la vivienda",
            ]} />
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-xl font-semibold">No se cancelan</h2>
          <div className="mt-4">
            <Checklist kind="no" items={[
              "Pensiones de alimentos (hijos, expareja)",
              "Indemnizaciones derivadas de un delito",
              "Indemnizaciones por muerte o daños a personas, incluidos accidentes de trabajo",
              "Multas penales y sanciones administrativas muy graves",
              "Salarios que debas a tus trabajadores (con los límites de la ley)",
              "Deudas con hipoteca o prenda, hasta el valor del bien",
              "Las costas y gastos del propio procedimiento",
            ]} />
          </div>
        </Card>
      </div>

      <Card tone="sage" className="mt-4">
        <h2 className="font-display text-xl font-semibold">Hacienda, Seguridad Social y otras administraciones</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-slate-700">
          <li>De lo que debas a <strong>cada administración</strong> se cancelan los <strong>primeros 5.000 €</strong> y, a partir de ahí, <strong>la mitad</strong>, con un máximo de <strong>10.000 €</strong> cancelados.</li>
          <li>El Tribunal Supremo aplica este límite también a comunidades autónomas y ayuntamientos, y permite cancelar enteros los <strong>recargos e intereses</strong>.</li>
          <li>Solo la primera vez: si vuelves a acogerte a la ley, no se cancela nada de deuda pública.</li>
        </ul>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-4 text-[15px]"><div className="text-slate-500">Debes 8.000 € a Hacienda</div><div className="mt-1 font-semibold">Se cancelan 6.500 € (5.000 + la mitad de 3.000)</div></div>
          <div className="rounded-2xl bg-white p-4 text-[15px]"><div className="text-slate-500">Debes 30.000 € a Hacienda</div><div className="mt-1 font-semibold">Se cancelan 10.000 €, el máximo</div></div>
        </div>
      </Card>

      <Card tone="warn" className="mt-4">
        <h2 className="font-semibold">Importante: tus avalistas</h2>
        <p className="mt-1.5 leading-relaxed text-slate-700">
          La cancelación te protege a ti. Quien te avaló, firmó contigo como deudor solidario o hipotecó un bien suyo por tu deuda sigue respondiendo,
          y el acreedor puede reclamarle.
        </p>
      </Card>
      <Source>arts. 489 a 492 del Texto Refundido de la Ley Concursal, en la redacción de la Ley 16/2022; Tribunal Supremo, Sala Primera, sentencias de 18 de febrero de 2026 sobre crédito público.</Source>
      <ClosingCta />
    </>
  );
}
