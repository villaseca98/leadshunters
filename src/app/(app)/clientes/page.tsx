import Link from "next/link";
import { query } from "@/lib/db";
import { billingForMonth } from "@/lib/services/billing";
import { currentMonth, eur } from "@/lib/format";
import { A, Badge, Empty, PageHeader, Table, Td, btn } from "@/components/ui";

export default async function Clientes() {
  const month = currentMonth();
  const clients = await query<{ id: string; name: string; city: string | null; status: string; monthly_fee: number; price_per_consultation: number; contact_name: string | null }>(
    "SELECT id, name, city, status, monthly_fee, price_per_consultation, contact_name FROM clients ORDER BY status, name",
  );
  const bill = new Map((await billingForMonth(month)).map((b) => [b.client_id, b]));
  return (
    <>
      <PageHeader title="Clientes" eyebrow="Despachos que pagan" actions={<Link href="/clientes/nuevo" className={btn.primary}>+ Nuevo cliente</Link>} />
      {clients.length === 0 ? (
        <Empty>Aún no hay clientes. Convierte un despacho desde Prospección o créalo a mano.</Empty>
      ) : (
        <Table head={["Despacho", "Estado", "Condiciones", "Leads mes", "Cualificados", "Consultas", "Realizadas", "Facturación mes"]}>
          {clients.map((c) => {
            const b = bill.get(c.id);
            return (
              <tr key={c.id} className="hover:bg-slate-50">
                <Td primary><A href={`/clientes/${c.id}`}>{c.name}</A><div className="text-xs text-slate-500">{[c.contact_name, c.city].filter(Boolean).join(" · ")}</div></Td>
                <Td><Badge tone={c.status === "activo" ? "emerald" : c.status === "pausado" ? "amber" : "slate"}>{c.status}</Badge></Td>
                <Td className="text-xs">{eur(c.monthly_fee)} + {eur(c.price_per_consultation)}/consulta</Td>
                <Td>{b?.leads ?? 0}</Td>
                <Td hide>{b?.leads_cualificados ?? 0}</Td>
                <Td hide>{b?.citas_agendadas ?? 0}</Td>
                <Td className="font-medium text-emerald-700">{b?.citas_asistidas ?? 0}</Td>
                <Td className="num text-base font-semibold">{eur(b?.total ?? 0)}</Td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
