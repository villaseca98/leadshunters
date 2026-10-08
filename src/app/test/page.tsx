// Test público para particulares: "¿Puedo cancelar mis deudas?". Es la página a la que llevan los anuncios.
import type { Metadata } from "next";
import Link from "next/link";
import { contactInfo } from "@/lib/settings";
import { CONSENT_TEXT, QUESTIONS } from "@/lib/lsoTest";
import { PROVINCES } from "@/lib/normalize";
import { TestForm } from "./TestForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await contactInfo();
  return {
    title: `¿Puedo cancelar mis deudas? Test gratuito · ${brand}`,
    description: "Responde unas preguntas y descubre en 2 minutos si tu caso encaja con la Ley de Segunda Oportunidad.",
  };
}

export default async function TestPage(props: PageProps<"/test">) {
  const sp = await props.searchParams;
  const utm = Object.fromEntries(
    Object.entries(sp).filter(([k, v]) => typeof v === "string" && /^utm_|^fbclid$|^gclid$/.test(k)) as [string, string][],
  );
  const c = await contactInfo();
  const holder = c.legal || c.name;
  const privacyNote = `Responsable: ${holder}. Finalidad: valorar tu caso y contactarte. Base: tu consentimiento. Destinatario: el despacho de abogados colaborador de tu provincia. Puedes ejercer tus derechos de acceso, rectificación, supresión y demás${c.email ? ` en ${c.email}` : ""} y reclamar ante la AEPD.`;
  return (
    <main className="brand-mcn min-h-dvh px-5" style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top, 0px))", paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}>
      <div className="mx-auto w-full max-w-xl">
        <Link href="/" className="font-display text-lg font-semibold">{c.brand}</Link>
        <TestForm questions={QUESTIONS} provinces={PROVINCES} consentText={CONSENT_TEXT(c.brand)} utm={utm} privacyNote={privacyNote} />
        <p className="mt-8 text-center text-xs leading-relaxed text-slate-400">
          Resultado orientativo y gratuito. No es asesoramiento legal: lo revisa un abogado colegiado de un despacho colaborador y la decisión final es del juez.
          <br />
          {c.brand} no es un despacho de abogados. <a href="/privacidad" className="underline">Política de privacidad</a> · <a href="/aviso-legal" className="underline">Aviso legal</a>
        </p>
      </div>
    </main>
  );
}
