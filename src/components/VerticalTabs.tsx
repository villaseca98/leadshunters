import { query } from "@/lib/db";
import { ChipLink } from "./ui";

/** Chips para pasar de una línea de negocio a otra en las listas de leads (despachos + las de cada empresa). */
export async function VerticalTabs({ active }: { active: string }) {
  const lines = await query<{ slug: string; name: string; emoji: string; kind: string; company: string; n: number }>(
    `SELECT bl.slug, bl.name, bl.emoji, bl.kind, c.name AS company,
            CASE WHEN bl.kind = 'despachos' THEN (SELECT count(*) FROM leads)::int
                 ELSE (SELECT count(*) FROM line_leads ll WHERE ll.line_id = bl.id)::int END AS n
       FROM business_lines bl JOIN companies c ON c.id = bl.company_id
      WHERE bl.active AND c.active
      ORDER BY bl.kind = 'despachos' DESC, c.name, bl.position, bl.name`,
  ).catch(() => []);
  return (
    <div className="lh-rail -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {lines.map((l) => (
        <ChipLink key={l.slug} href={l.kind === "despachos" ? "/leads" : `/lineas?linea=${l.slug}`} active={active === l.slug}>
          {l.emoji} {l.kind === "despachos" ? "Despachos" : l.name} <span className="num text-xs opacity-70">{l.n}</span>
        </ChipLink>
      ))}
      <ChipLink href="/lineas" active={active === "todas"}>Todas las demás</ChipLink>
    </div>
  );
}
