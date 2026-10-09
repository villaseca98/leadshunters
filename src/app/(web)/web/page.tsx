// Portada de la web para particulares. En los dominios de consumo se sirve en `/`.
import type { Metadata } from "next";
import { contactInfo } from "@/lib/settings";
import { Checklist, ClosingCta, CtaButton, Eyebrow, SectionHead, TextLink } from "@/components/web/Site";

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

const QUICK = ["Eres particular o autónomo", "No puedes pagar tus deudas con regularidad", "Debes a dos o más acreedores", "Has actuado de buena fe"];

export default async function Home() {
  const { brand } = await contactInfo();
  return (
    <>
      {/* Portada */}
      <section className="grid gap-12 pt-6 md:grid-cols-[1.35fr_1fr] md:items-center md:gap-16 md:pt-16">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-1 text-[13px] text-slate-600">
            <span className="size-1.5 rounded-full bg-sage" />
            Ley de Segunda Oportunidad · España
          </div>
          <h1 className="font-display mt-6 text-[2.75rem] font-medium leading-[1.02] md:text-[4.5rem]">
            Cancelar las deudas que no puedes pagar es un derecho.{" "}
            <span className="text-slate-400">Con condiciones.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-500">
            Desde 2022, quien no puede pagar sus deudas y ha actuado de buena fe puede pedir al juez que cancele las que no puede pagar, con algunas
            excepciones. Te contamos, sin letra pequeña, si tu caso encaja.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
            <CtaButton />
            <TextLink href="/requisitos">¿Cumplo los requisitos?</TextLink>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-7 ring-1 ring-black/[0.06] md:p-9">
          <div className="text-[13px] text-slate-500">Para empezar, la ley pide que</div>
          <ol className="mt-5 divide-y divide-black/[0.06]">
            {QUICK.map((q, i) => (
              <li key={q} className="flex items-baseline gap-4 py-3.5">
                <span className="num w-5 text-[13px] text-slate-400">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[16px]">{q}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-[13px] leading-relaxed text-slate-500">¿Te reconoces? El test lo comprueba en 2 minutos y un abogado colegiado revisa tu caso.</p>
        </div>
      </section>

      {/* Compromisos */}
      <section className="mt-20 grid border-y border-black/[0.06] md:grid-cols-3">
        {[
          ["Abogados colegiados", "Tu caso lo revisa un despacho colaborador, no un comercial."],
          ["Sin letra pequeña", "También te contamos lo que la ley no cancela."],
          ["Tus datos, con permiso", "Solo para tu caso y solo si nos lo autorizas."],
        ].map(([t, d], i) => (
          <div key={t} className={`py-7 md:px-8 ${i ? "border-t border-black/[0.06] md:border-l md:border-t-0" : "md:pl-0"}`}>
            <div className="font-medium">{t}</div>
            <p className="mt-1 text-[15px] leading-relaxed text-slate-500">{d}</p>
          </div>
        ))}
      </section>

      {/* Qué se cancela y qué no */}
      <section className="mt-28">
        <SectionHead title={<>Lo que se cancela.<br /><span className="text-slate-400">Y lo que no.</span></>} intro="La ley cancela casi todo lo que no puedes pagar, pero protege algunas deudas. Mejor saberlo desde el principio." />
        <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <Eyebrow>Normalmente sí</Eyebrow>
            <div className="mt-5 text-[17px]">
              <Checklist items={[
                "Préstamos personales, tarjetas y créditos revolving",
                "Microcréditos y descubiertos",
                "Deudas con proveedores, alquileres y suministros",
                "Avales personales",
                "Hacienda, Seguridad Social y ayuntamiento, hasta un límite",
              ]} />
            </div>
          </div>
          <div>
            <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-400">No se cancelan</div>
            <div className="mt-5 text-[17px]">
              <Checklist kind="no" items={[
                "Pensiones de alimentos",
                "Indemnizaciones por delito o por daños a personas",
                "Multas penales y sanciones administrativas muy graves",
                "Deudas con hipoteca o prenda, hasta el valor del bien",
                "La deuda pública por encima de los límites legales",
              ]} />
            </div>
          </div>
        </div>
        <div className="mt-10"><TextLink href="/deudas">Ver el detalle de cada deuda →</TextLink></div>
      </section>

      {/* Hacienda en cifras */}
      <section className="mt-28 rounded-[2rem] bg-sage-soft px-6 py-12 md:px-12 md:py-16">
        <SectionHead title="¿Y lo que debo a Hacienda o a la Seguridad Social?" intro="Se cancela una parte, por cada administración. Así se calcula:" />
        <dl className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            ["5.000 €", "Los primeros se cancelan enteros."],
            ["50 %", "De lo que pase de 5.000 €, se cancela la mitad."],
            ["10.000 €", "Es lo máximo que se cancela por administración."],
          ].map(([n, d]) => (
            <div key={n} className="border-t border-sage/20 pt-5">
              <dt className="font-display num text-5xl font-medium text-sage md:text-6xl">{n}</dt>
              <dd className="mt-3 max-w-[16rem] leading-relaxed text-slate-600">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-10 text-[15px] text-slate-600">Ejemplo: si debes 8.000 € a Hacienda, se cancelarían 6.500 € (5.000 + la mitad de 3.000). Solo la primera vez que te acoges a la ley.</p>
      </section>

      {/* Proceso */}
      <section className="mt-28">
        <SectionHead title="Cómo funciona" intro="Es un procedimiento judicial. Lo lleva un abogado con un procurador y lo decide el juez." />
        <ol className="mt-12 grid gap-10 md:grid-cols-4 md:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.t} className="border-t border-ink pt-5">
              <div className="num text-[13px] text-slate-400">{String(i + 1).padStart(2, "0")}</div>
              <h3 className="mt-3 text-lg font-medium">{s.t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-500">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10"><TextLink href="/como-funciona">Los dos caminos: liquidación o plan de pagos →</TextLink></div>
      </section>

      {/* Letra pequeña, en grande */}
      <section className="mt-28 grid gap-10 md:grid-cols-[1fr_1.4fr] md:gap-16">
        <h2 className="font-display text-3xl font-medium leading-[1.1] md:text-[2.5rem]">Lo que nadie te cuenta.</h2>
        <ul className="divide-y divide-black/[0.06] border-y border-black/[0.06] text-[17px] leading-relaxed">
          {[
            ["Tus avalistas", "Si alguien te avaló, seguirá debiendo: la cancelación te protege a ti, no a quien te avaló."],
            ["Tres años de vigilancia", "Se puede revocar si aparecen bienes ocultos o recibes una herencia, donación o premio importante."],
            ["Tiene un coste", `Hay honorarios de abogado y procurador. ${brand} no cobra por el test.`],
            ["Nadie lo garantiza", "Desconfía de quien te asegure el resultado: lo decide el juez."],
          ].map(([t, d]) => (
            <li key={t} className="grid gap-1 py-5 md:grid-cols-[12rem_1fr] md:gap-6">
              <span className="font-medium">{t}</span>
              <span className="text-slate-500">{d}</span>
            </li>
          ))}
        </ul>
      </section>

      <ClosingCta />
    </>
  );
}
