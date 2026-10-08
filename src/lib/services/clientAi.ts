import "server-only";
// Asistente IA de cada cliente: le explicas el caso en dos líneas y monta sus condiciones, marcadores, métricas clave y plan;
// cada mes escribe el informe con la evolución y los pasos a seguir a partir de lo que ya mide la app.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";
import { query, queryOne } from "../db";
import { currentMonth, eur, monthLabel, shiftMonth } from "../format";
import { planName } from "../plans";
import { getLine } from "./lines";
import { despachoBilling, lineClient, lineClientBilling, markersFor, type ClientKind } from "./clientMetrics";

const MODEL = "claude-opus-5-5";

export type AiMessage = { role: "user" | "assistant"; text: string; at: string };
export type AiPlan = { resumen: string; metricas: string[]; pasos: string[]; objetivos: string[] };
export type AiState = { messages: AiMessage[]; plan: AiPlan | null };

/** Clave de Claude: variable de entorno o la que se pega en Ajustes. */
export async function anthropicKey(): Promise<string | null> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const row = await queryOne<{ value: string }>("SELECT value FROM app_settings WHERE key = 'ANTHROPIC_API_KEY'").catch(() => null);
  return row?.value || null;
}

export async function saveAnthropicKey(key: string) {
  await query(
    "INSERT INTO app_settings(key, value) VALUES ('ANTHROPIC_API_KEY', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [key.trim()],
  );
}

export async function aiState(kind: ClientKind, id: string): Promise<AiState> {
  const row = await queryOne<{ messages: AiMessage[]; plan: AiPlan | null }>(
    "SELECT messages, plan FROM client_ai WHERE client_kind = $1 AND client_id = $2",
    [kind, id],
  );
  return { messages: row?.messages ?? [], plan: row?.plan ?? null };
}

export async function clientReports(kind: ClientKind, id: string) {
  return query<{ id: string; month: string; body: string; created_at: string }>(
    "SELECT id, month, body, created_at FROM client_reports WHERE client_kind = $1 AND client_id = $2 ORDER BY month DESC LIMIT 12",
    [kind, id],
  );
}

// ---------- Contexto: todo lo que la app ya sabe del cliente ----------

type Ctx = { name: string; text: string; conditions: ("fijo_mensual" | "por_consulta" | "por_showup" | "por_venta" | "por_lead" | "comision_pct")[]; fields: { key: string; label: string }[] };

async function markerText(kind: ClientKind, id: string, month: string) {
  const ms = await markersFor(kind, id, month);
  return ms.length ? ms.map((m) => `${m.label}: ${m.unit === "eur" ? eur(m.value) : m.value}${m.billable ? " (se factura)" : ""}`).join("; ") : "sin marcadores";
}

async function context(kind: ClientKind, id: string, months = 3): Promise<Ctx | null> {
  const now = currentMonth();
  const list = Array.from({ length: months }, (_, i) => shiftMonth(now, -i));
  if (kind === "despacho") {
    const c = await queryOne<{ name: string; vertical: string; plan: string; status: string; monthly_fee: number; price_per_consultation: number; price_per_lead: number | null; price_per_sale: number | null; sale_commission_pct: number | null; city: string | null; provinces: string[]; notes: string | null; started_at: string }>(
      "SELECT name, vertical, plan, status, monthly_fee, price_per_consultation, price_per_lead, price_per_sale, sale_commission_pct, city, provinces, notes, started_at::text FROM clients WHERE id = $1",
      [id],
    );
    if (!c) return null;
    const energy = c.vertical !== "lso";
    const head = energy
      ? `Cliente de ${c.vertical === "luz" ? "luz (Recorta)" : "placas solares (Recorta)"}: ${c.name}. Estado ${c.status}. Fijo ${eur(c.monthly_fee)}/mes, ${eur(c.price_per_lead ?? 0)} por lead aceptado, ${eur(c.price_per_sale ?? 0)} por venta, ${c.sale_commission_pct ?? 0} % de comisión de obra.`
      : `Despacho de Ley de Segunda Oportunidad (Leads Hunters): ${c.name}${c.city ? `, ${c.city}` : ""}. Provincias: ${c.provinces.join(", ") || "toda España"}. Plan ${planName(c.plan)}, estado ${c.status}. Cobro: ${eur(c.monthly_fee)}/mes fijo + ${eur(c.price_per_consultation)} por consulta realizada (show-up). La primera consulta es gratis si se llamó al lead después de 5 minutos.`;
    const rows = [];
    for (const m of list) {
      const [b] = await despachoBilling(m, id);
      rows.push(`${monthLabel(m)}: ${b ? energy
        ? `${b.leads} leads, ${b.oportunidades} oportunidades, ${b.leads_aceptados} aceptados, ${b.ventas} ventas; facturación ${eur(b.total_con_marcadores)}`
        : `${b.leads} leads, ${b.leads_cualificados} cualificados, ${b.citas_agendadas} consultas agendadas, ${b.citas_asistidas} realizadas, ${b.citas_no_asistio} no asistieron; facturación ${eur(b.total_con_marcadores)}` : "sin datos"}. Marcadores: ${await markerText(kind, id, m)}`);
    }
    return {
      name: c.name,
      text: `${head}\nCliente desde ${c.started_at}. Notas: ${c.notes || "—"}\nÚltimos meses:\n${rows.join("\n")}`,
      conditions: energy ? ["fijo_mensual", "por_lead", "por_venta", "comision_pct"] : ["fijo_mensual", "por_consulta"],
      fields: [],
    };
  }
  const c = await lineClient(id);
  if (!c) return null;
  const line = await getLine(c.line_id);
  if (!line) return null;
  const data = line.client_fields.map((f) => `${f.label}: ${c.data[f.key] || "—"}`).join("; ");
  const rows = [];
  for (const m of list) {
    const [b] = await lineClientBilling(m, id);
    rows.push(`${monthLabel(m)}: ${b ? `${b.leads} leads, ${b.contactados} contactados, ${b.showups} show-ups, ${b.ventas} ${line.won_label.toLowerCase()}; facturación ${eur(b.total)}` : "sin datos"}. Marcadores: ${await markerText(kind, id, m)}`);
  }
  return {
    name: c.name,
    text: `Cliente de la línea ${line.name} (empresa ${line.company_name}): ${c.name}. Estado ${c.status}. Cobro: ${eur(c.monthly_fee)}/mes fijo, ${eur(c.price_per_showup)} por show-up, ${c.price_per_sale ? `${eur(c.price_per_sale)} por ${line.won_label.toLowerCase()}` : `el ${line.value_label.toLowerCase()} de cada lead cerrado`}.
Ficha: ${data || "—"}
Cliente desde ${c.started_at}. Notas: ${c.notes || "—"}
Últimos meses:
${rows.join("\n")}`,
    conditions: ["fijo_mensual", "por_showup", "por_venta"],
    fields: line.client_fields.map((f) => ({ key: f.key, label: f.label })),
  };
}

const SYSTEM = `Eres el asistente del CRM privado de Leads Hunters, una empresa que capta clientes para negocios (despachos de Ley de Segunda Oportunidad, luz y placas solares con Recorta, webs con MewHub y otras ramas). Solo lo ve el dueño, que escribe rápido y con faltas: entiende lo que quiere decir.
Cada cliente es un caso distinto. Cuando el dueño te explica cómo es un cliente (qué le paga, por qué cobra, qué quiere conseguir), tú lo dejas montado en la app:
- condiciones de cobro (solo las que la app admite para este cliente; null si no cambian),
- marcadores mensuales para lo que la app no mide sola (ventas fuera de la app, comisiones, renovaciones, reuniones…); los de euros que se cobran al cliente van con facturable=true,
- datos de su ficha si los menciona,
- y un plan: resumen del acuerdo, métricas clave a vigilar, pasos a seguir y objetivos.
No inventes cifras que no te haya dado: si falta algo importante pregúntalo en la respuesta y deja ese campo en null.
La respuesta va en español de España, corta y clara (2 a 5 frases): di qué has dejado configurado y, si hace falta, una pregunta concreta.`;

function schemaFor(ctx: Ctx) {
  const cond = Object.fromEntries(ctx.conditions.map((k) => [k, z.number().nullable()])) as Record<string, z.ZodNullable<z.ZodNumber>>;
  return z.object({
    respuesta: z.string(),
    condiciones: z.object(cond),
    marcadores: z.array(z.object({ nombre: z.string(), unidad: z.enum(["num", "eur"]), facturable: z.boolean() })),
    ficha: z.array(z.object({ clave: z.string(), valor: z.string() })),
    nota: z.string().nullable(),
    plan: z.object({ resumen: z.string(), metricas: z.array(z.string()), pasos: z.array(z.string()), objetivos: z.array(z.string()) }).nullable(),
  });
}

function client(key: string) {
  return new Anthropic({ apiKey: key });
}

/** Mensaje de error entendible para el dueño. */
export function aiError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "La clave de Claude no es válida. Revísala en Ajustes.";
  if (e instanceof Anthropic.RateLimitError) return "Claude está saturado ahora mismo. Prueba en un minuto.";
  if (e instanceof Anthropic.APIError) return `Claude no ha podido responder (${e.status ?? "sin conexión"}). Prueba otra vez.`;
  return e instanceof Error ? e.message : "No se ha podido hablar con la IA.";
}

/** Un turno del chat: guarda lo que dices, pide a Claude que monte el cliente y aplica lo que devuelve. */
export async function chatTurn(kind: ClientKind, id: string, text: string): Promise<{ error?: string }> {
  const key = await anthropicKey();
  if (!key) return { error: "Falta la clave de Claude: pégala en Ajustes y vuelve a enviar." };
  const ctx = await context(kind, id);
  if (!ctx) return { error: "Cliente no encontrado." };
  const state = await aiState(kind, id);
  const now = new Date().toISOString();
  const history = [...state.messages, { role: "user" as const, text, at: now }];
  const schema = schemaFor(ctx);

  const res = await client(key).messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(schema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Así está ahora el cliente en la app:\n${ctx.text}\n\nPlan actual: ${state.plan ? JSON.stringify(state.plan) : "ninguno todavía"}\nCondiciones que puedes poner: ${ctx.conditions.join(", ")} (en euros; comision_pct en %).${ctx.fields.length ? `\nCampos de su ficha: ${ctx.fields.map((f) => `${f.key} (${f.label})`).join(", ")}.` : ""}`,
      },
      { role: "assistant", content: "Entendido. Cuéntame el caso." },
      ...history.slice(-21).map((m) => ({ role: m.role, content: m.text })),
    ],
  });
  if (res.stop_reason === "refusal") return { error: "La IA no ha querido responder a eso. Reformúlalo." };
  const out = res.parsed_output;
  if (!out) return { error: "La IA no ha devuelto una respuesta válida. Prueba otra vez." };

  await apply(kind, id, ctx, out);
  const messages = [...history, { role: "assistant" as const, text: out.respuesta, at: new Date().toISOString() }];
  await query(
    `INSERT INTO client_ai(client_kind, client_id, messages, plan) VALUES ($1, $2, $3, $4)
     ON CONFLICT (client_kind, client_id) DO UPDATE SET messages = EXCLUDED.messages, plan = coalesce(EXCLUDED.plan, client_ai.plan), updated_at = now()`,
    [kind, id, JSON.stringify(messages), out.plan ? JSON.stringify(out.plan) : null],
  );
  return {};
}

type Out = z.infer<ReturnType<typeof schemaFor>>;

async function apply(kind: ClientKind, id: string, ctx: Ctx, out: Out) {
  const c = out.condiciones as Record<string, number | null>;
  const set: [string, number][] = [];
  const col: Record<string, string> = kind === "despacho"
    ? { fijo_mensual: "monthly_fee", por_consulta: "price_per_consultation", por_lead: "price_per_lead", por_venta: "price_per_sale", comision_pct: "sale_commission_pct" }
    : { fijo_mensual: "monthly_fee", por_showup: "price_per_showup", por_venta: "price_per_sale" };
  for (const k of ctx.conditions) {
    const v = c[k];
    if (v != null && Number.isFinite(v) && v >= 0 && col[k]) set.push([col[k], v]);
  }
  const table = kind === "despacho" ? "clients" : "line_clients";
  if (set.length) {
    // si cambia lo que paga un despacho deja de ser un plan cerrado
    const extra = kind === "despacho" && set.some(([k]) => k === "monthly_fee" || k === "price_per_consultation") ? ", plan = 'personalizado'" : "";
    await query(`UPDATE ${table} SET ${set.map(([k], i) => `${k} = $${i + 2}`).join(", ")}${extra} WHERE id = $1`, [id, ...set.map(([, v]) => v)]);
  }
  if (out.nota?.trim()) {
    await query(`UPDATE ${table} SET notes = trim(both E'\\n' from coalesce(notes, '') || E'\\n' || $2) WHERE id = $1`, [id, out.nota.trim().slice(0, 1000)]);
  }
  if (kind === "linea" && out.ficha.length) {
    const allowed = new Set(ctx.fields.map((f) => f.key));
    const data = Object.fromEntries(out.ficha.filter((f) => allowed.has(f.clave) && f.valor.trim()).map((f) => [f.clave, f.valor.trim().slice(0, 200)]));
    if (Object.keys(data).length) await query("UPDATE line_clients SET data = data || $2::jsonb WHERE id = $1", [id, JSON.stringify(data)]);
  }
  const month = currentMonth();
  await markersFor(kind, id, month); // crea los del mes si aún no existen
  for (const m of out.marcadores.slice(0, 8)) {
    const label = m.nombre.trim().slice(0, 60);
    if (!label) continue;
    await query(
      `INSERT INTO client_markers(client_kind, client_id, month, label, unit, billable, position)
       VALUES ($1, $2, $3, $4, $5, $6, (SELECT coalesce(max(position), 0) + 1 FROM client_markers WHERE client_kind = $1 AND client_id = $2 AND month = $3))
       ON CONFLICT (client_kind, client_id, month, label) DO NOTHING`,
      [kind, id, month, label, m.unidad, m.unidad === "eur" && m.facturable],
    );
  }
}

/** Informe del mes: evolución frente a los meses anteriores, qué se le factura y pasos a seguir. Se guarda (uno por mes). */
export async function monthReport(kind: ClientKind, id: string, month: string): Promise<{ error?: string }> {
  const key = await anthropicKey();
  if (!key) return { error: "Falta la clave de Claude: pégala en Ajustes." };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Mes no válido." };
  const ctx = await context(kind, id, 4);
  if (!ctx) return { error: "Cliente no encontrado." };
  const state = await aiState(kind, id);
  const res = await client(key).messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium" },
    system: `${SYSTEM.split("\n")[0]}\nAhora escribes el informe interno mensual de un cliente para que el dueño lo optimice. Texto plano, sin markdown ni asteriscos. Secciones en este orden, cada una con su título en una línea: RESUMEN, EVOLUCIÓN (compara con los meses anteriores con cifras), QUÉ LE FACTURAS, QUÉ FUNCIONA Y QUÉ NO, PASOS A SEGUIR (3 a 6 líneas que empiecen por "- "). Máximo 300 palabras. No inventes datos que no estén.`,
    messages: [
      {
        role: "user",
        content: `Informe de ${monthLabel(month)}.\n${ctx.text}\n\nAcuerdo y plan del cliente: ${state.plan ? JSON.stringify(state.plan) : "sin plan todavía"}\nLo que el dueño ha contado del cliente:\n${state.messages.filter((m) => m.role === "user").slice(-10).map((m) => `- ${m.text}`).join("\n") || "—"}`,
      },
    ],
  });
  if (res.stop_reason === "refusal") return { error: "La IA no ha querido escribir el informe." };
  const body = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
  if (!body) return { error: "La IA ha devuelto un informe vacío. Prueba otra vez." };
  await query(
    `INSERT INTO client_reports(client_kind, client_id, month, body) VALUES ($1, $2, $3, $4)
     ON CONFLICT (client_kind, client_id, month) DO UPDATE SET body = EXCLUDED.body, created_at = now()`,
    [kind, id, month, body],
  );
  return {};
}
