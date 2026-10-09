import type { Metadata } from "next";
import { contactInfo } from "@/lib/settings";
import { ClosingCta, PageTitle } from "@/components/web/Site";

export const metadata: Metadata = {
  title: "Preguntas frecuentes sobre la Ley de Segunda Oportunidad",
  description: "Respuestas claras a las dudas más habituales: la casa, la pareja, los costes, los plazos y las garantías.",
};

export default async function Preguntas() {
  const { brand } = await contactInfo();
  const FAQ: [string, string][] = [
    ["¿Es seguro que me cancelen las deudas?", "No. Depende de que cumplas los requisitos y de la decisión del juez. Desconfía de quien te lo garantice."],
    ["¿Pierdo mi casa?", "No necesariamente, pero conservarla no es automático. Con un plan de pagos puedes mantenerla si sigues pagando la hipoteca; el plan dura entonces 5 años. Si se liquidan tus bienes, la vivienda se vendería."],
    ["¿Afecta a mi pareja?", "Si tu pareja no firmó las deudas, no responde de ellas. Si estáis en gananciales puede haber efectos sobre los bienes comunes: lo revisa el abogado."],
    ["¿Y a quien me avaló?", "Sí: tus avalistas y codeudores siguen respondiendo de la deuda aunque a ti te la cancelen."],
    ["¿Cuánto tarda?", "Como orientación, entre 6 y 12 meses sin bienes ni oposición, y entre 12 y 24 si hay bienes que vender. Depende mucho de la carga de tu juzgado. Con plan de pagos, súmale los 3 o 5 años del plan."],
    ["¿Cuánto cuesta?", `El test de ${brand} es gratuito. Necesitas abogado y procurador, que son obligatorios; sus honorarios los fija el despacho y te los da por escrito antes de empezar, y suelen poder pagarse a plazos. No hay tasa judicial, y si cumples los requisitos puedes pedir justicia gratuita.`],
    ["Tengo tarjetas revolving, ¿qué hago?", "Antes de nada, el abogado debería revisar si tu tarjeta tiene intereses abusivos o poco transparentes. Si es así, puedes reclamarlos y deber solo lo que te prestaron, lo que a veces cambia todo el caso."],
    ["¿Necesito un mínimo de deuda?", "La ley no fija un mínimo. Con deudas pequeñas a veces compensa más negociar con los acreedores: el abogado te dirá qué te conviene."],
    ["¿Puedo si soy autónomo?", "Sí. Se pueden cancelar deudas con proveedores y bancos, y las de Hacienda y Seguridad Social hasta el límite legal. Si sigues en activo con un negocio pequeño, puede aplicarse el procedimiento especial para microempresas."],
    ["¿Salgo de los ficheros de morosos?", "El juez ordena a los acreedores que comuniquen la cancelación a los ficheros de morosos para que actualicen tus datos. Nadie puede garantizarte un plazo concreto para salir."],
    [`¿Quién es ${brand}?`, `Un servicio que pone en contacto a personas con deudas con despachos de abogados colegiados. ${brand} no es un despacho ni presta asesoramiento jurídico.`],
  ];
  return (
    <>
      <PageTitle eyebrow="Preguntas" title="Preguntas frecuentes" />
      <div className="mt-14 max-w-3xl divide-y divide-black/[0.06] border-y border-black/[0.06]">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group py-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium">
              {q}
              <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full ring-1 ring-black/10 text-slate-500 transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 max-w-2xl pr-12 leading-relaxed text-slate-500">{a}</p>
          </details>
        ))}
      </div>
      <ClosingCta />
    </>
  );
}
