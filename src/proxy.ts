// Separa la web para particulares (el test) del CRM por dominio.
// En el dominio del CRM (leadshunters…, *.vercel.app, localhost) todo sigue igual.
// En cualquier otro dominio conectado al proyecto solo existen el test (en la raíz) y la política de privacidad.
import { NextResponse, type NextRequest } from "next/server";

const isAppHost = (host: string) =>
  !host.startsWith("consumer.") && (/leadshunters|\.vercel\.app$|^localhost$|^127\.0\.0\.1$/.test(host));

export function proxy(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (isAppHost(host)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/test";
    return NextResponse.rewrite(url);
  }
  if (pathname === "/privacidad") return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/";
  if (pathname !== "/test") url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp|woff2?)$).*)"],
};
