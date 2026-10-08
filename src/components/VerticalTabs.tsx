import { ChipLink } from "./ui";

/** Chips para pasar de una línea de negocio a otra en las listas de leads. */
export function VerticalTabs({ active, counts }: { active: "despachos" | "luz" | "placas" | "todas"; counts?: Partial<Record<string, number>> }) {
  const n = (k: string) => (counts?.[k] != null ? <span className="num text-xs opacity-70">{counts[k]}</span> : null);
  return (
    <div className="lh-rail -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <ChipLink href="/leads" active={active === "despachos"}>⚖️ Despachos {n("despachos")}</ChipLink>
      <ChipLink href="/energia?linea=luz" active={active === "luz"}>💡 Luz {n("luz")}</ChipLink>
      <ChipLink href="/energia?linea=placas" active={active === "placas"}>☀️ Placas {n("placas")}</ChipLink>
      <ChipLink href="/energia" active={active === "todas"}>Luz + placas</ChipLink>
    </div>
  );
}
