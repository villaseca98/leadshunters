// Página pública de la campaña: qué provincias siguen libres (1 despacho Premium por provincia) y cuánto queda para el cierre.
import type { Metadata } from "next";
import { query } from "@/lib/db";
import { PROVINCES } from "@/lib/normalize";
import { contactInfo } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Plazas libres · Leads Hunters",
  description: "Consultas precualificadas de Ley de Segunda Oportunidad. Solo 1 despacho por provincia.",
};

const CIERRE = new Date("2026-12-31T23:59:59+01:00");
const daysLeft = (now: number) => Math.max(0, Math.ceil((CIERRE.getTime() - now) / 86400000));

export default async function PlazasPage() {
  const rows = await query<{ provinces: string[] }>(`SELECT provinces FROM clients WHERE status = 'activo' AND plan = 'premium'`);
  const taken = new Set(rows.flatMap((r) => r.provinces));
  const free = PROVINCES.filter((p) => !taken.has(p)).length;
  const { phone, email } = await contactInfo();
  const digits = phone.replace(/\D/g, "");
  const link = (p: string) => {
    const msg = `Hola, quiero la plaza de ${p} en Leads Hunters`;
    if (digits) return `https://wa.me/${digits.length === 9 ? "34" + digits : digits}?text=${encodeURIComponent(msg)}`;
    return email ? `mailto:${email}?subject=${encodeURIComponent(msg)}` : undefined;
  };
  const days = daysLeft(new Date().getTime());
  return (
    <main className="min-h-dvh bg-ink px-5 py-8 text-white">
      <div className="mx-auto w-full max-w-xl">
        <div className="font-display text-lg font-semibold text-blaze">Leads Hunters</div>
        <h1 className="mt-4 font-display text-3xl font-bold leading-tight">Segunda Oportunidad: 1 despacho por provincia</h1>
        <p className="mt-3 text-white/75">Consultas precualificadas: test de 6 preguntas, llamada en menos de 5 minutos y ficha del caso en tu agenda. Solo pagas las consultas que se realizan.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-4"><div className="font-display text-3xl font-bold text-blaze">{free}</div><div className="text-sm text-white/70">provincias libres de {PROVINCES.length}</div></div>
          <div className="rounded-2xl bg-white/10 p-4"><div className="font-display text-3xl font-bold">{days}</div><div className="text-sm text-white/70">días para el cierre (31 dic)</div></div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {PROVINCES.map((p) => (
            <a key={p} href={taken.has(p) ? undefined : link(p)}
              className={`rounded-xl px-2 py-2 text-center text-xs font-semibold ${taken.has(p) ? "bg-white/5 text-white/35 line-through" : "bg-moss/80 text-white"}`}>
              {taken.has(p) ? "🔒 " : ""}{p}
            </a>
          ))}
        </div>
        <p className="mt-6 text-sm text-white/60">Pulsa tu provincia para reservar una llamada. Cuando un despacho la ocupa, se cierra.</p>
      </div>
    </main>
  );
}
