// Política de privacidad del test para particulares (/test).
import type { Metadata } from "next";
import { contactInfo } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Política de privacidad" };

export default async function Privacidad() {
  const c = await contactInfo();
  const holder = c.legal || c.name;
  return (
    <main className="min-h-dvh bg-paper px-5 py-8">
      <article className="mx-auto max-w-2xl space-y-4 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-6 [&_h2]:font-semibold [&_h2]:text-ink">
        <h1 className="font-display text-2xl font-semibold text-ink">Política de privacidad · {c.brand}</h1>
        <h2>Quién trata tus datos</h2>
        <p>{holder}{c.email ? ` · ${c.email}` : ""}, que opera la marca {c.brand}.</p>
        <h2>Para qué</h2>
        <p>Para revisar si puedes acogerte a la Ley de Segunda Oportunidad, llamarte para comentarlo y, si encaja, ponerte en contacto con un despacho de abogados colaborador de tu provincia para que te dé una consulta. Si marcas la casilla opcional, también para enviarte avisos y consejos sobre deudas por WhatsApp.</p>
        <h2>Con qué base legal</h2>
        <p>Tu consentimiento, que das al marcar la casilla del test. Puedes retirarlo cuando quieras sin que afecte a lo hecho antes.</p>
        <h2>A quién se comunican</h2>
        <p>Al despacho de abogados colaborador que atiende tu provincia, solo para estudiar tu caso. También los tratan, por cuenta nuestra, los proveedores técnicos que alojan la web y la base de datos. No vendemos tus datos ni los usamos para otra cosa.</p>
        <h2>Cuánto tiempo</h2>
        <p>Mientras estudiamos tu caso y, como máximo, 12 meses desde que hiciste el test, salvo que pidas antes que los borremos.</p>
        <h2>Tus derechos</h2>
        <p>Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a {c.email || "nuestro email de contacto"}. Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>
      </article>
    </main>
  );
}
