import type { ReactNode } from "react";
import { addMarker } from "@/app/(app)/clientes/markers";
import type { ClientKind, Marker } from "@/lib/services/clientMetrics";
import { eur, monthLabel, shiftMonth } from "@/lib/format";
import { Card, Field, btn, input } from "@/components/ui";
import { MarkersEditor } from "./MarkersEditor";

export type BillLine = { label: ReactNode; detail?: ReactNode; amount: number };

/**
 * Métricas y facturación de un cliente en un mes: de dónde sale lo que le facturas,
 * los marcadores que vas sumando a mano y el formulario para añadir otro.
 */
export function ClientMetrics({ kind, clientId, month, basePath, lines, markers, total, children }: {
  kind: ClientKind;
  clientId: string;
  month: string;
  basePath: string;
  lines: BillLine[];
  markers: Marker[];
  total: number;
  children?: ReactNode;
}) {
  const extra = markers.filter((m) => m.unit === "eur" && m.billable && m.value !== 0);
  return (
    <Card
      title={`Métricas y facturación · ${monthLabel(month)}`}
      actions={
        <div className="flex gap-1">
          <a href={`${basePath}?mes=${shiftMonth(month, -1)}`} className={btn.ghost} aria-label="Mes anterior">←</a>
          <a href={`${basePath}?mes=${shiftMonth(month, 1)}`} className={btn.ghost} aria-label="Mes siguiente">→</a>
        </div>
      }
    >
      {children}
      <div className="rounded-2xl bg-slate-50 p-3 sm:p-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Qué le facturas</div>
        <ul className="divide-y divide-slate-200 text-sm">
          {lines.map((l, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 py-2">
              <div>{l.label}{l.detail && <div className="text-xs text-slate-500">{l.detail}</div>}</div>
              <div className="num shrink-0 font-medium">{eur(l.amount, 2)}</div>
            </li>
          ))}
          {extra.map((m) => (
            <li key={m.id} className="flex items-baseline justify-between gap-3 py-2">
              <div>{m.label}<div className="text-xs text-slate-500">marcador</div></div>
              <div className="num shrink-0 font-medium">{eur(m.value, 2)}</div>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-3 pt-3">
            <div className="font-semibold">Total sin IVA</div>
            <div className="num shrink-0 text-xl font-semibold text-emerald-700">{eur(total, 2)}</div>
          </li>
        </ul>
        <p className="mt-1 text-right text-xs text-slate-500">{eur(total * 1.21, 2)} con IVA</p>
      </div>

      <div className="mt-5 mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Marcadores</div>
      {markers.length ? <MarkersEditor markers={markers} /> : <p className="text-sm text-slate-500">Sin marcadores este mes.</p>}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-indigo-700">+ Añadir marcador</summary>
        <form action={addMarker.bind(null, kind, clientId, month)} className="mt-3 grid gap-3 sm:grid-cols-4 sm:items-end">
          <div className="sm:col-span-2"><Field label="Nombre"><input name="label" required placeholder="Ventas, bonus, comisión placas…" className={input} /></Field></div>
          <Field label="Tipo">
            <select name="unit" className={input} defaultValue="eur">
              <option value="eur">Importe (€)</option>
              <option value="num">Contador</option>
            </select>
          </Field>
          <Field label="Valor inicial"><input name="value" inputMode="decimal" placeholder="0" className={input} /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input type="checkbox" name="billable" defaultChecked className="size-4" /> Si es un importe, sumarlo a lo que le facturas
          </label>
          <button className={btn.primary}>Añadir</button>
        </form>
      </details>
    </Card>
  );
}
