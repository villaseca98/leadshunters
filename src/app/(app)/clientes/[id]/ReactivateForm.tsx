"use client";
import { useActionState } from "react";
import { btn, input } from "@/components/ui";

export function ReactivateForm({ action }: { action: (prev: unknown, fd: FormData) => Promise<{ ok: boolean; message: string }> }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="space-y-3">
      <input type="file" name="file" accept=".csv,text/csv" required className={input} />
      <label className="flex gap-2.5 text-xs leading-snug text-slate-600">
        <input type="checkbox" name="consent_ok" value="1" required className="mt-0.5 size-4 shrink-0" />
        <span>El despacho me confirma que estas personas le pidieron información y aceptaron que las llamara. Les llamamos en su nombre.</span>
      </label>
      <button className={btn.secondary} disabled={pending}>{pending ? "Importando…" : "Importar y poner en cola"}</button>
      {state && <p className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{state.message}</p>}
    </form>
  );
}
