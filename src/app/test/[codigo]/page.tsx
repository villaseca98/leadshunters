// Test con el nombre de un despacho cliente: el anuncio sale desde su página de Facebook y el lead es suyo.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FIRM_CONSENT_TEXT, QUESTIONS } from "@/lib/lsoTest";
import { PROVINCES } from "@/lib/normalize";
import { clientByTestCode } from "@/lib/services/testLeads";
import { TestForm } from "../TestForm";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/test/[codigo]">): Promise<Metadata> {
  const firm = await clientByTestCode((await props.params).codigo);
  return {
    title: firm ? `¿Puedo cancelar mis deudas? Consulta gratuita · ${firm.name}` : "Test",
    description: "Responde unas preguntas y descubre en 2 minutos si tu caso encaja con la Ley de Segunda Oportunidad.",
  };
}

export default async function FirmTest(props: PageProps<"/test/[codigo]">) {
  const { codigo } = await props.params;
  const firm = await clientByTestCode(codigo);
  if (!firm) notFound();
  const sp = await props.searchParams;
  const utm = Object.fromEntries(
    Object.entries(sp).filter(([k, v]) => typeof v === "string" && /^utm_|^fbclid$|^gclid$/.test(k)) as [string, string][],
  );
  const privacy = `/privacidad?d=${codigo}`;
  return (
    <main className="min-h-dvh bg-paper px-5" style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top, 0px))", paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}>
      <div className="mx-auto w-full max-w-xl">
        <div className="font-display text-lg font-semibold">{firm.name}</div>
        <div className="text-xs text-slate-500">Abogados especialistas en Ley de Segunda Oportunidad</div>
        <TestForm questions={QUESTIONS} provinces={PROVINCES} consentText={FIRM_CONSENT_TEXT(firm.name)} utm={utm} code={codigo} privacyHref={privacy} />
        <p className="mt-8 text-center text-xs leading-relaxed text-slate-400">
          Resultado orientativo y gratuito. No es asesoramiento legal: lo confirma un abogado del despacho en la consulta.
          <br />
          <a href={privacy} className="underline">Política de privacidad</a>
        </p>
      </div>
    </main>
  );
}
