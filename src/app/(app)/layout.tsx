import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { SectionTabs, Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const q = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM leads l JOIN clients c ON c.id = l.client_id
      WHERE c.status = 'activo' AND l.status IN ('nuevo','no_contesta','volver_a_llamar')
        AND l.qualification_status <> 'no_cualificado' AND l.next_call_at <= now() AND l.phone IS NOT NULL`,
  );
  // más los de las demás líneas (luz, placas…), para que "Cazar" cuente todo lo que espera
  const q2 = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM line_leads ll JOIN business_lines bl ON bl.id = ll.line_id
      WHERE bl.active AND ll.status IN ('nuevo','no_contesta') AND ll.next_call_at <= now()`,
  );
  return (
    <div className="min-h-screen">
      <Sidebar user={user} queueCount={(q?.n ?? 0) + (q2?.n ?? 0)} />
      <main className="lg:pl-64">
        <div className="pb-dock mx-auto max-w-7xl px-4 pt-2 sm:px-6 lg:px-10 lg:pt-10"><SectionTabs />{children}</div>
      </main>
    </div>
  );
}
