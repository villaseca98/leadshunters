import "server-only";
import { extractData, type Line } from "@/lib/lineas";
import { normalizeCode, parseUtm } from "@/lib/partners";
import { submitLineLead, type LineResult } from "@/lib/services/lines";

/** Lead del formulario web de una empresa (Recorta, MewHub…) en su línea. Los datos de energía se pasan a las preguntas de la línea. */
export async function submitWebLineLead(b: Record<string, unknown>, line: Line): Promise<LineResult> {
  const s = (k: string) => (b[k] == null ? undefined : String(b[k]));
  const energy = (b.energy && typeof b.energy === "object" ? b.energy : {}) as Record<string, unknown>;
  const roof = s("roof") ?? (energy.roof as string | undefined);
  const mapped: Record<string, unknown> = {
    ...energy,
    ...b,
    factura: b.factura ?? b.monthly_bill ?? energy.monthly_bill,
    compania: b.compania ?? b.current_supplier ?? energy.current_supplier,
    tipo_cliente: b.tipo_cliente ?? (b.business_type || energy.business_type ? "negocio" : undefined),
    propietario: b.propietario ?? (roof ? (/propi/.test(roof) ? "si" : "no") : undefined),
  };
  for (const k of ["energy", "answers", "client_id", "client_key", "form_id", "source", "external_id", "full_name", "phone", "email", "province", "consent_text", "consent_at", "consent", "monthly_bill", "current_supplier", "roof", "utm", "partner", "p", "campaign"]) delete mapped[k];
  return submitLineLead({
    line,
    full_name: s("full_name") ?? "",
    phone: s("phone") ?? "",
    email: s("email") ?? null,
    province: s("province") ?? null,
    data: extractData(line.fields, mapped),
    // el formulario web solo se envía con la casilla de consentimiento marcada
    consent: b.consent !== false,
    channel: s("source") === "web" || !s("source") ? "web" : s("source")!,
    campaign: s("campaign") ?? `web-${line.slug}`,
    utm: parseUtm(b.utm),
    partner_code: normalizeCode(b.partner ?? b.p),
    raw: b,
  });
}
