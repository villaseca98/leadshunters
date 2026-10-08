// Portada de la web para particulares. En los dominios de consumo se sirve en `/`.
import type { Metadata } from "next";
import Link from "next/link";
import { contactInfo } from "@/lib/settings";
import { Card, Checklist, ClosingCta, CtaButton } from "@/components/web/Site";

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await contactInfo();
  return {
    title: `${brand} · Ley de Segunda Oportunidad sin letra pequeña`,
    description: "Comprueba si tu caso encaja con la Ley de Segunda Oportunidad: qué deudas se pueden cancelar, cuáles no y qué requisitos pide la ley.",
  };
}

const STEPS = [
  { t: "Haces el test", d: "Unas preguntas sobre tus deudas y tu situación. Dos minutos, gratis y sin compromiso." },
  { t: "Te llama un abogado", d: "Si tu caso encaja, un abogado colegiado de un despacho colaborador revisa tu caso y tus documentos." },
  { t: "Presupuesto por escrito", d: "Si decides seguir, el despacho te da sus honorarios por escrito antes de empezar." },
  { t: "Decide el juez", d: "El despacho presenta tu solicitud en el juzgado. La decisión final es siempre del juez." },
];

export default async function Home() {
  const { brand } = await contactInfo();
  return (
    <>
      <section className="grid items-center gap-8 md:grid-cols-[1.25fr_1fr]">
        <div>
          <div className="inline-flex rounded-full bg-sage-soft px-3 py-1 text-xs font-semibold text-sage">Ley de Segunda Oportunidad · España</div>
          <h1 className="font-display mt-4 text-4xl font-semibold leading-[1.08] md:text-5xl">Las deudas no definen tu futuro.</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-600">
            Desde 2022, una persona que no puede pagar sus deudas y ha actuado de buena fe puede pedir al juez que cancele las que no puede pagar,
            con algunas excepciones. Te contamos, sin letra pequeña, si tu caso encaja.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <CtaButton />
            <Link href="/requisitos" className="text-sm font-semibold text-sage underline-offset-4 hover:underline">¿Cumplo los requisitos? →</Link>
          </div>
        </div>
        <Card tone="sage" className="space-y-4">
          <div className="text-sm font-semibold text-sage">Antes de nada, tres compromisos</div>
          <Checklist items={[
            "Tu caso lo revisa un abogado colegiado de un despacho colaborador.",
            "Te contamos también lo que la ley no perdona.",
            "Tus datos, solo con tu permiso y solo para tu caso.",
          ]} />
        </Card>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold">¿Para quién es?</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            ["Particulares y autónomos", "Personas físicas. Las sociedades no, aunque su administrador sí puede por sus deudas personales, como los avales."],
            ["Que no pueden pagar", "Estás en insolvencia: no llegas a pagar tus deudas con regularidad, o sabes que pronto no podrás."],
            ["Con dos o más acreedores", "Bancos, financieras, tarjetas, Hacienda, proveedores… En la práctica los juzgados piden al menos dos."],
          ].map(([t, d]) => (
            <Card key={t}>
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1.5 leading-relaxed text-slate-600">{d}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-semibold">Lo que la ley puede cancelar</h2>
          <div className="mt-4">
            <Checklist items={[
              "Préstamos personales, tarjetas y créditos revolving",
              "Microcréditos y descubiertos",
              "Deudas con proveedores, alquileres y suministros",
              "Avales personales",
              "Hacienda, Seguridad Social y ayuntamiento, solo hasta un límite",
            ]} />
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-xl font-semibold">Lo que no cancela</h2>
          <div className="mt-4">
            <Checklist kind="no" items={[
              "Pensiones de alimentos",
              "Indemnizaciones por delito o por daños a personas",
              "Multas penales y sanciones administrativas muy graves",
              "Deudas con hipoteca o prenda, hasta el valor del bien",
              "La deuda pública por encima de los límites legales",
            ]} />
          </div>
          <Link href="/deudas" className="mt-4 inline-block text-sm font-semibold text-sage underline-offset-4 hover:underline">Ver el detalle →</Link>
        </Card>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold">Cómo funciona</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t}>
              <Card className="h-full">
                <div className="num text-3xl font-semibold text-sage">{i + 1}</div>
                <h3 className="mt-2 font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{s.d}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <Card tone="warn">
          <h2 className="font-semibold">Lo que nadie te cuenta</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-slate-700">
            <li>Si alguien te avaló, seguirá debiendo: la cancelación te protege a ti, no a tus avalistas.</li>
            <li>Durante 3 años se puede revocar si aparecen bienes ocultos o recibes una herencia, donación o premio importante.</li>
            <li>Hay honorarios de abogado y procurador. {brand} no cobra por el test.</li>
            <li>Desconfía de quien te garantice el resultado: lo decide el juez.</li>
          </ul>
        </Card>
      </section>

      <ClosingCta />
    </>
  );
}
