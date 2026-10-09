// Web pública para particulares (marca de consumo). En los dominios de consumo la portada `/` muestra /web (ver src/proxy.ts).
import { contactInfo } from "@/lib/settings";
import { SiteFooter, SiteHeader } from "@/components/web/Site";

export const dynamic = "force-dynamic";

export default async function WebLayout({ children }: { children: React.ReactNode }) {
  const c = await contactInfo();
  return (
    <div className="brand-mcn min-h-dvh">
      <SiteHeader brand={c.brand} />
      <main className="mx-auto max-w-6xl px-5 pt-8 md:pt-12">{children}</main>
      <SiteFooter c={c} />
    </div>
  );
}
