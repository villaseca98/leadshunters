import type { Metadata } from "next";
import { Card, Checklist, ClosingCta, PageTitle, Source } from "@/components/web/Site";

export const metadata: Metadata = {
  title: "Requisitos de la Ley de Segunda Oportunidad",
  description: "Quién puede acogerse a la Ley de Segunda Oportunidad y quién no, según la Ley Concursal reformada en 2022.",
};

export default function Requisitos() {
  return (
    <>
      <PageTitle
        eyebrow="Requisitos"
        title="¿Puedo acogerme a la Ley de Segunda Oportunidad?"
        intro="Necesitas cumplir todo lo de la primera lista y no estar en ninguno de los casos de la segunda."
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-semibold">Lo que tienes que cumplir</h2>
          <div className="mt-4">
            <Checklist items={[
              <><strong>Ser persona física</strong>: particular, autónomo o empresario individual. Las sociedades no; su administrador sí, por sus deudas personales (por ejemplo, avales).</>,
              <><strong>Estar en insolvencia</strong>: no poder pagar con regularidad tus deudas, o saber que pronto no podrás. Tener deudas no basta si puedes pagarlas.</>,
              <><strong>Tener al menos dos acreedores</strong>, que es lo que en la práctica piden los juzgados.</>,
              <><strong>Ser deudor de buena fe</strong>: no estar en ninguno de los casos de la derecha.</>,
              <><strong>No haber cancelado deudas con esta ley hace poco</strong>: hacen falta 2 años si fue con plan de pagos, o 5 si fue vendiendo tus bienes.</>,
            ]} />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-500">No hay un importe mínimo de deuda en la ley. Ya no hace falta intentar antes un acuerdo extrajudicial de pagos.</p>
        </Card>
        <Card>
          <h2 className="font-display text-xl font-semibold">Cuándo no puedes, en general</h2>
          <div className="mt-4">
            <Checklist kind="no" items={[
              "Condena firme a prisión en los últimos 10 años por delitos contra el patrimonio y el orden socioeconómico, falsedad documental, contra Hacienda o la Seguridad Social o contra los trabajadores. Salvo que esté extinguida y pagada la responsabilidad.",
              "Sanción firme muy grave de Hacienda, Seguridad Social o del orden social en los últimos 10 años (y graves por encima de cierto importe). Salvo que la hayas pagado entera.",
              "Tu concurso se declaró culpable, o te declararon persona afectada en el concurso culpable de otro (por ejemplo, de tu empresa) en los últimos 10 años.",
              "Diste información falsa o te endeudaste de forma temeraria o negligente.",
              "No colaboras con el juzgado ni con la administración concursal.",
            ]} />
          </div>
        </Card>
      </div>
      <Card tone="sage" className="mt-4">
        <h2 className="font-semibold">¿Y si me derivaron deudas de mi empresa?</h2>
        <p className="mt-1.5 leading-relaxed text-slate-700">
          Que Hacienda o la Seguridad Social te hayan derivado deudas como administrador no te impide por sí solo acogerte. Según el Tribunal Supremo
          (sentencias de 18 de febrero de 2026) solo lo impide si hubo una conducta fraudulenta. Un abogado lo revisa con tu expediente.
        </p>
      </Card>
      <Source>arts. 2 y 486-488 del Texto Refundido de la Ley Concursal (Real Decreto Legislativo 1/2020), en la redacción de la Ley 16/2022;
        sentencia del Tribunal de Justicia de la UE de 7 de noviembre de 2024 (asuntos C-289/23 y C-305/23); Tribunal Supremo, Sala Primera, sentencias de 18 de febrero de 2026.</Source>
      <ClosingCta />
    </>
  );
}
