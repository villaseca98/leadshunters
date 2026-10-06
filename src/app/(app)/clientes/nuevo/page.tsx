import { requireAdmin } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "../ClientForm";
import { createClient } from "../actions";

export default async function NuevoCliente() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Nuevo cliente" subtitle="Un despacho que ya ha firmado. Si viene de Prospección, usa «Convertir en cliente» en su ficha." />
      <Card><ClientForm action={createClient} submit="Crear cliente" /></Card>
    </>
  );
}
