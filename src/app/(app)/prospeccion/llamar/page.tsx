import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db";
import { A, Empty, PageHeader } from "@/components/ui";

/** Abre el siguiente despacho a llamar: primero los que tienen una acción vencida, luego los nuevos con mejor puntuación. */
export default async function NextProspect() {
  const p = await queryOne<{ id: string }>(
    `SELECT id FROM prospects
      WHERE status IN ('nuevo','a_llamar','no_contesta','contactado','interesado','propuesta') AND phone IS NOT NULL
        AND (next_action_at <= now() OR (next_action_at IS NULL AND status IN ('nuevo','a_llamar')))
      ORDER BY (next_action_at IS NOT NULL) DESC, score DESC, reviews_count DESC NULLS LAST
      LIMIT 1`,
  );
  if (p) redirect(`/prospeccion/${p.id}?modo=llamada`);
  return (
    <>
      <PageHeader title="Llamar despachos" />
      <Empty>
        No queda ningún despacho pendiente de llamar ahora mismo. Busca más con el flujo de prospección de n8n o{" "}
        <A href="/prospeccion/importar">importa resultados</A>.
      </Empty>
    </>
  );
}
