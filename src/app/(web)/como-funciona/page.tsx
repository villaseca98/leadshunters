import type { Metadata } from "next";
import { Card, ClosingCta, PageTitle, Source } from "@/components/web/Site";

export const metadata: Metadata = {
  title: "Cómo funciona la Ley de Segunda Oportunidad",
  description: "Los dos caminos para cancelar deudas: con liquidación de bienes o con plan de pagos, y qué pasa después.",
};

export default function ComoFunciona() {
  return (
    <>
      <PageTitle eyebrow="Proceso" title="Cómo funciona" intro="Es un procedimiento judicial: lo lleva un abogado con un procurador y lo decide el juez. Hay dos caminos." />
      <div className="mt-14 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">Camino 1</div>
          <h2 className="font-display mt-2 text-2xl font-medium">Con liquidación de bienes</h2>
          <p className="mt-2 leading-relaxed text-slate-600">
            Se venden los bienes que se puedan embargar y se cancela lo que quede por pagar. Si no tienes bienes, el proceso es más corto
            (“concurso sin masa”): se puede pedir la cancelación directamente, salvo que acreedores que sumen al menos el 5 % de la deuda pidan
            que se investigue.
          </p>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">Camino 2</div>
          <h2 className="font-display mt-2 text-2xl font-medium">Con plan de pagos</h2>
          <p className="mt-2 leading-relaxed text-slate-600">
            Conservas tus bienes, por ejemplo tu casa, y pagas una parte de tus deudas durante <strong>3 años</strong>, o <strong>5 años</strong> si
            conservas tu vivienda habitual o si los pagos dependen sobre todo de tus ingresos. Al terminar el plan, la cancelación es definitiva.
          </p>
        </Card>
      </div>
      <Card className="mt-4">
        <h2 className="font-display text-2xl font-medium">Después de la cancelación</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed text-slate-700">
          <li>Los acreedores de las deudas canceladas ya no pueden reclamártelas.</li>
          <li>Durante <strong>3 años</strong> la cancelación se puede revocar si aparecen bienes o ingresos ocultos, si mejoras mucho por una herencia, donación o premio, o si llega una condena o sanción firme que estaba en trámite.</li>
          <li>Si eliges plan de pagos y no lo cumples, se puede revocar.</li>
          <li>Las resoluciones del concurso se inscriben en el Registro Público Concursal.</li>
        </ul>
      </Card>
      <Source>arts. 493 y 495-502 del Texto Refundido de la Ley Concursal, en la redacción de la Ley 16/2022.</Source>
      <ClosingCta />
    </>
  );
}
