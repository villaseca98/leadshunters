// Separa la web para particulares (el test) del CRM por dominio.
// En el dominio del CRM (leadshunters…, *.vercel.app, localhost) todo sigue igual.
// En cualquier otro dominio conectado al proyecto (la marca para particulares, p. ej. micuentanueva.es) solo existe
// la web pública: la portada (/web servida en la raíz), las páginas informativas, el test y las páginas legales.
import { NextResponse, type NextRequest } from "next/server";

const isAppHost = (host: string) =>
  !host.startsWith("consumer.") && (/leadshunters|\.vercel\.app$|^localhost$|^127\.0\.0\.1$/.test(host));

const CONSUMER_PATHS = new Set(["/test", "/requisitos", "/deudas", "/como-funciona", "/preguntas", "/privacidad", "/aviso-legal", "/cookies"]);

export function proxy(req: NextRequest) {
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (isAppHost(host)) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/") {
    // Quien llega desde un anuncio (con utm/fbclid/gclid) va directo al test, como antes; el resto ve la portada
    const fromAd = [...req.nextUrl.searchParams.keys()].some((k) => /^utm_|^fbclid$|^gclid$/.test(k));
    const url = req.nextUrl.clone();
    url.pathname = fromAd ? "/test" : "/web";
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
