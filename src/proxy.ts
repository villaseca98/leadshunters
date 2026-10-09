// Separa el test para particulares del CRM por dominio.
// La web de Mi Cuenta Nueva vive en su propio repositorio (villaseca98/micuentanueva) y manda los leads a /api/v1/particulares.
// En el dominio del CRM (leadshunters…, *.vercel.app, localhost) todo sigue igual.
// En cualquier otro dominio conectado a este proyecto solo existen el test (servido en la raíz) y las páginas legales.
import { NextResponse, type NextRequest } from "next/server";

const isAppHost = (host: string) =>
  !host.startsWith("consumer.") && (/leadshunters|\.vercel\.app$|^localhost$|^127\.0\.0\.1$/.test(host));

const CONSUMER_PATHS = new Set(["/test", "/privacidad"]);

export function proxy(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (isAppHost(host)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/test";
    return NextResponse.rewrite(url);
  }
  if (CONSUMER_PATHS.has(pathname)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp|woff2?)$).*)"],
};
