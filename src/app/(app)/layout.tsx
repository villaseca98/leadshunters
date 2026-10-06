import { requireUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const q = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM leads l JOIN clients c ON c.id = l.client_id
      WHERE c.status = 'activo' AND l.status IN ('nuevo','no_contesta','volver_a_llamar')
        AND l.qualification_status <> 'no_cualificado' AND l.next_call_at <= now() AND l.phone IS NOT NULL`,
  );
  return (
    <div className="min-h-screen">
      <Sidebar user={user} queueCount={q?.n ?? 0} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
