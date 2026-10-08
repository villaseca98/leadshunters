import { Card } from "@/components/ui";
import type { Vertical } from "@/lib/energy";

/** Guion de la llamada según la línea de negocio. La marca es la que oye el lead (Recorta, el despacho…). */
export function CallScript({ vertical, name, brand }: { vertical: Vertical; name: string; brand: string }) {
  const first = name.split(" ")[0];
  const steps =
    vertical === "luz"
      ? [
          `«Hola ${first}, soy [nombre] de ${brand}. Has mirado en nuestra web cuánto podrías ahorrar en la luz del negocio, ¿tienes dos minutos?»`,
          "«¿Qué negocio tienes y cuánto pagas de luz al mes, más o menos?»",
          "«¿Sabes si tu tarifa es 2.0 o 3.0? Viene arriba en la factura, en ‘peaje’. ¿Con qué compañía estás y tienes permanencia?»",
          "«Lo que más se suele ahorrar en negocios es potencia mal ajustada, reactiva y servicios extra que no usas. Con la factura te lo digo exacto.»",
          "«¿Me mandas una foto de la última factura por WhatsApp? Te preparo la comparativa y te llamo con los números.»",
          "Marca «Pedir factura y preparar oferta». Nada de cambiar sin que vea la oferta por escrito.",
        ]
      : vertical === "placas"
        ? [
            `«Hola ${first}, soy [nombre] de ${brand}. Nos pediste información sobre placas solares para tu negocio, ¿tienes dos minutos?»`,
            "«¿Cuánto pagas de luz al mes? ¿El consumo es sobre todo de día o de noche?» (de día = más ahorro)",
            "«¿La cubierta o el tejado es tuyo, de la comunidad o estás de alquiler?» (alquiler o comunidad: hace falta permiso)",
            "«¿En qué zona estás?» Confirma código postal: el instalador tiene que llegar.",
            "«Te pongo en contacto con un instalador de tu zona que te hace el estudio y el presupuesto gratis. ¿Te viene mejor que te llame por la mañana o por la tarde?»",
            "Marca «Pasar al instalador». Recuerda: el lead se cobra si el instalador lo acepta.",
          ]
        : [
            `«Hola ${first}, soy [nombre] del equipo de ${brand}. Nos dejaste tus datos hace un momento sobre tus deudas, ¿tienes dos minutos?»`,
            "«Para ver si la Ley de Segunda Oportunidad encaja contigo: ¿cuánto debes en total, más o menos? ¿Con cuántos bancos o financieras?»",
            "«¿Tienes ingresos ahora mismo? ¿Tienes casa en propiedad?»",
            "«¿Has usado esta ley en los últimos 5 años? ¿Alguna condena por delitos económicos?» (si es que sí, no cualifica)",
            "«Por lo que me cuentas, un abogado especialista puede revisar tu caso sin compromiso. ¿Te va bien el [día] a las [hora]?»",
            "Confirma teléfono y email. «Te llegará un recordatorio antes de la cita.»",
          ];
  return (
    <Card title="Guion de llamada">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
        {steps.map((t, i) => <li key={i}>{t}</li>)}
      </ol>
    </Card>
  );
}
