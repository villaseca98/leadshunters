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
    ["¿Pierdo mi casa?", "No necesariamente. Con un plan de pagos puedes conservarla si sigues pagando la hipoteca; el plan dura entonces 5 años. Si se liquidan tus bienes, la vivienda se vendería."],
    ["¿Afecta a mi pareja?", "Si tu pareja no firmó las deudas, no responde de ellas. Si estáis en gananciales puede haber efectos sobre los bienes comunes: lo revisa el abogado."],
    ["¿Y a quien me avaló?", "Sí: tus avalistas y codeudores siguen respondiendo de la deuda aunque a ti te la cancelen."],
    ["¿Cuánto tarda?", "Depende del juzgado y del camino elegido. El abogado te dará una estimación con tu caso concreto."],
    ["¿Cuánto cuesta?", `El test de ${brand} es gratuito. Los honorarios los fija el despacho colaborador y te los da por escrito antes de empezar.`],
    ["¿Necesito un mínimo de deuda?", "La ley no fija un mínimo. Con deudas pequeñas a veces compensa más negociar con los acreedores: el abogado te dirá qué te conviene."],
    ["¿Puedo si soy autónomo?", "Sí. Se pueden cancelar deudas con proveedores y bancos, y las de Hacienda y Seguridad Social hasta el límite legal."],
    ["¿Salgo de los ficheros de morosos?", "Las deudas canceladas dejan de poder reclamarse. El despacho te orienta para actualizar tu situación en los ficheros."],
    [`¿Quién es ${brand}?`, `Un servicio que pone en contacto a personas con deudas con despachos de abogados colegiados. ${brand} no es un despacho ni presta asesoramiento jurídico.`],
  ];
  return (
    <>
      <PageTitle eyebrow="Preguntas" title="Preguntas frecuentes" />
      <div className="mt-8 divide-y divide-black/5 rounded-[1.5rem] bg-white ring-1 ring-black/5">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group p-5 md:px-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {q}
              <span aria-hidden className="text-sage transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 leading-relaxed text-slate-600">{a}</p>
          </details>
        ))}
      </div>
      <ClosingCta />
    </>
  );
}
