"use client";
import { useFormStatus } from "react-dom";

/** Caja para contarle el caso a la IA al crear un cliente: al guardar, la IA monta sus condiciones, marcadores y plan. */
export function AiCaseField() {
  return (
    <label className="block rounded-2xl bg-orange-50 p-3 ring-2 ring-blaze sm:p-4">
      <span className="mb-1 block text-sm font-semibold text-ink">✨ Cuéntale el caso a la IA</span>
      <span className="mb-2 block text-xs text-slate-600">En dos líneas: qué te paga y por qué (fijo, por show-up, por venta, comisión…), qué quiere conseguir y lo que tenga de especial. Al crear el cliente la IA le monta las condiciones, los marcadores y un plan con métricas y pasos.</span>
      <textarea
        name="ia"
        rows={3}
        placeholder="Ej.: me paga 300 € fijos y 50 € por cada persona que va a la cita; quiere 20 al mes y cobra a 30 días…"
        className="block w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-[15px] ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm"
      />
    </label>
  );
}

/** Botón de crear que avisa mientras la IA prepara el cliente. */
export function CreateButton({ children, className }: { children: string; className: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={`${className} disabled:opacity-60`}>{pending ? "Creando y montando con la IA…" : children}</button>;
}
