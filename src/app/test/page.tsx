// Test público para particulares: "¿Puedo cancelar mis deudas?". Es la página a la que llevan los anuncios.
import type { Metadata } from "next";
import { contactInfo } from "@/lib/settings";
import { CONSENT_TEXT, QUESTIONS } from "@/lib/lsoTest";
import { PROVINCES } from "@/lib/normalize";
import { TestForm } from "./TestForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await contactInfo();
  return {
    title: `¿Puedo cancelar mis deudas? Test gratuito · ${brand}`,
    description: "Responde 6 preguntas y descubre en 1 minuto si puedes acogerte a la Ley de Segunda Oportunidad.",
  };
}

export default async function TestPage(props: PageProps<"/test">) {
  const sp = await props.searchParams;
  const utm = Object.fromEntries(
    Object.entries(sp).filter(([k, v]) => typeof v === "string" && /^utm_|^fbclid$|^gclid$/.test(k)) as [string, string][],
  );
  const { brand } = await contactInfo();
  return (
    <main className="min-h-dvh bg-paper px-5" style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top, 0px))", paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}>
      <div className="mx-auto w-full max-w-xl">
        <div className="font-display text-lg font-semibold">{brand}</div>
        <TestForm questions={QUESTIONS} provinces={PROVINCES} consentText={CONSENT_TEXT(brand)} utm={utm} />
        <p className="mt-8 text-center text-xs leading-relaxed text-slate-400">
          Resultado orientativo y gratuito. No es asesoramiento legal: lo confirma un abogado especialista en la consulta.
          <br />
          <a href="/privacidad" className="underline">Política de privacidad</a>
        </p>
      </div>
    </main>
  );
}
