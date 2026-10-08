// Política de privacidad del test para particulares (/test).
import type { Metadata } from "next";
import Link from "next/link";
import { contactInfo } from "@/lib/settings";
import { clientByTestCode } from "@/lib/services/testLeads";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Política de privacidad" };

export default async function Privacidad(props: PageProps<"/privacidad">) {
  const sp = await props.searchParams;
  const firm = typeof sp.d === "string" ? await clientByTestCode(sp.d) : null;
  const c = await contactInfo();
  const holder = c.legal || c.name;
  if (firm) {
    return (
      <main className="min-h-dvh bg-paper px-5 py-8">
        <article className="mx-auto max-w-2xl space-y-4 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-6 [&_h2]:font-semibold [&_h2]:text-ink">
          <h1 className="font-display text-2xl font-semibold text-ink">Política de privacidad · {firm.name}</h1>
          <h2>Quién trata tus datos</h2>
          <p>{firm.name} es el responsable. Su equipo de atención ({holder}{c.email ? `, ${c.email}` : ""}) trata los datos por cuenta del despacho como encargado del tratamiento, para atenderte y agendar tu consulta.</p>
          <h2>Para qué</h2>
          <p>Para revisar si puedes acogerte a la Ley de Segunda Oportunidad, llamarte para comentarlo y, si encaja, darte una consulta con el despacho. Si marcas la casilla opcional, también para enviarte avisos y consejos sobre deudas por WhatsApp.</p>
          <h2>Con qué base legal</h2>
          <p>Tu consentimiento, que das al marcar la casilla del test. Puedes retirarlo cuando quieras sin que afecte a lo hecho antes.</p>
          <h2>A quién se comunican</h2>
          <p>A nadie fuera del despacho y de su equipo de atención, salvo los proveedores técnicos que alojan la web y la base de datos. No vendemos tus datos.</p>
          <h2>Cuánto tiempo</h2>
          <p>Mientras se estudia tu caso y, como máximo, 12 meses desde que hiciste el test si no llegas a contratar, salvo que pidas antes que los borremos.</p>
          <h2>Tus derechos</h2>
          <p>Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad al despacho{c.email ? ` o escribiendo a ${c.email}` : ""}. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>
        </article>
      </main>
    );
  }
  return (
    <main className="brand-mcn min-h-dvh px-5 py-8">
      <article className="mx-auto max-w-2xl space-y-4 text-[15px] leading-relaxed text-slate-700 [&_h2]:mt-6 [&_h2]:font-semibold [&_h2]:text-ink">
        <Link href="/" className="text-sm font-semibold text-sage">← {c.brand}</Link>
        <h1 className="font-display text-2xl font-semibold text-ink">Política de privacidad · {c.brand}</h1>
        <h2>Quién trata tus datos</h2>
        <p>{holder}{c.email ? ` · ${c.email}` : ""}, que opera la marca {c.brand}. Es el responsable del tratamiento.</p>
        <h2>Qué datos</h2>
        <p>Los que nos das en el test: nombre, teléfono, email si lo pones, provincia y tus respuestas sobre tus deudas, ingresos y situación. No te pedimos datos de salud ni documentos.</p>
        <h2>Para qué</h2>
        <p>Para valorar de forma orientativa si tu caso puede encajar en la Ley de Segunda Oportunidad, llamarte para comentarlo y, si encaja y nos das permiso, comunicar tus datos a un despacho de abogados colaborador de tu provincia para que estudie tu caso. Si marcas la casilla opcional, también para enviarte avisos y consejos sobre deudas por WhatsApp. El resultado del test no es una decisión sobre ti: solo ordena las llamadas, y quien valora tu caso es un abogado.</p>
        <h2>Con qué base legal</h2>
        <p>Tu consentimiento (art. 6.1.a del Reglamento General de Protección de Datos), que das al marcar la casilla del test. Puedes retirarlo cuando quieras sin que afecte a lo hecho antes. Solo te llamamos porque nos lo pides (art. 66.1.b de la Ley 11/2022 General de Telecomunicaciones).</p>
        <h2>A quién se comunican</h2>
        <p>Al despacho de abogados colaborador que atiende tu provincia, solo para estudiar tu caso; el despacho pasa a ser responsable de los datos que use para ello y te informará al contactarte. También los tratan, por cuenta nuestra y con contrato, los proveedores técnicos que alojan la web y la base de datos. Algunos pueden estar fuera del Espacio Económico Europeo; en ese caso, con las garantías que exige el Reglamento (Marco de Privacidad de Datos UE-EE. UU. o cláusulas contractuales tipo). No vendemos tus datos ni los usamos para otra cosa.</p>
        <h2>Cuánto tiempo</h2>
        <p>Mientras estudiamos tu caso y, como máximo, 12 meses desde que hiciste el test, salvo que pidas antes que los borremos. Después los bloqueamos solo el tiempo que obliga la ley para atender posibles reclamaciones.</p>
        <h2>Tus derechos</h2>
        <p>Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a {c.email || "nuestro email de contacto"}. Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</p>
      </article>
    </main>
  );
}
