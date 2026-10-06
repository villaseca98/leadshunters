"use client";
import { useActionState } from "react";
import { importProspects } from "../actions";
import { btn, input, label } from "@/components/ui";

export function ImportForm() {
  const [state, action, pending] = useActionState(importProspects, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <span className={label}>Archivo (.json de Apify o .csv)</span>
        <input type="file" name="file" accept=".json,.csv,text/csv,application/json" className={input} required />
      </div>
      <div>
        <span className={label}>Búsqueda usada (opcional)</span>
        <input name="search_term" placeholder="abogados segunda oportunidad Valencia" className={input} />
      </div>
      <button className={btn.primary} disabled={pending}>{pending ? "Importando y puntuando…" : "Importar"}</button>
      {state && (
        <p className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{state.message}</p>
      )}
    </form>
  );
}
