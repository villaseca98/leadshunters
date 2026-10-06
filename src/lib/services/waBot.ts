import "server-only";
import { query, queryOne } from "../db";
import { matchProvince, normalizePhone } from "../normalize";
import { CONSENT_TEXT, FIRM_CONSENT_TEXT, QUESTIONS, type TestAnswers } from "../lsoTest";
import { contactInfo } from "../settings";
import { appUrl } from "../appUrl";
import { clientByTestCode, submitTest } from "./testLeads";

// Asistente de WhatsApp 24 h (plan Premium): la persona escribe al WhatsApp del despacho
// (siempre es ella quien inicia) y el asistente le hace el mismo test que /test, paso a paso.
// Pasos: 0..5 preguntas · 6 nombre · 7 provincia · 8 consentimiento · 9 terminado.

const NAME = QUESTIONS.length, PROVINCE = NAME + 1, CONSENT = NAME + 2, DONE = NAME + 3;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const ask = (i: number) => {
  const q = QUESTIONS[i];
  return `*${i + 1}/${QUESTIONS.length}* ${q.title}\n\n${q.options.map((o, n) => `${n + 1}. ${o.label}`).join("\n")}\n\nResponde con el número.`;
};

type Conv = { phone: string; client_id: string | null; step: number; answers: Record<string, string>; done: boolean };

export async function handleWaMessage(input: { phone: string; text: string; client_code?: string | null }): Promise<{ reply: string; done: boolean }> {
  const phone = normalizePhone(input.phone.startsWith("+") ? input.phone : `+${input.phone.replace(/\D/g, "")}`);
  if (!phone) return { reply: "", done: false };
  const text = String(input.text ?? "").slice(0, 500);
  const t = norm(text);
  const firm = input.client_code ? await clientByTestCode(input.client_code) : null;
  const { brand } = await contactInfo();
  const who = firm?.name ?? brand;

  const c = await queryOne<Conv>("SELECT phone, client_id, step, answers, done FROM wa_conversations WHERE phone = $1", [phone]);
  const restart = /^(hola|empezar|reiniciar|inicio|test|menu)\b/.test(t);
  if (!c || (restart && (c.done || c.step === 0))) {
    await query(
      `INSERT INTO wa_conversations(phone, client_id, step, answers, done, updated_at) VALUES ($1,$2,0,'{}',false,now())
       ON CONFLICT (phone) DO UPDATE SET client_id = $2, step = 0, answers = '{}', done = false, updated_at = now()`,
      [phone, firm?.id ?? null],
    );
    return {
      reply: `Hola, soy el asistente de *${who}*. Te ayudo a saber en 1 minuto si puedes cancelar tus deudas con la Ley de Segunda Oportunidad. Es gratis y sin compromiso.\n\n${ask(0)}`,
      done: false,
    };
  }
  if (c.done) return { reply: `Ya tenemos tus datos y un especialista te llamará (lunes a sábado, de 9 a 21 h). Si quieres repetir el test, escribe *empezar*.`, done: true };

  const save = (step: number, answers = c!.answers, done = false) =>
    query("UPDATE wa_conversations SET step = $2, answers = $3, done = $4, updated_at = now() WHERE phone = $1", [phone, step, answers, done]);

  if (c.step < NAME) {
    const q = QUESTIONS[c.step];
    const n = Number(t.match(/^\d+/)?.[0]);
    const opt = q.options[n - 1] ?? q.options.find((o) => norm(o.label) === t);
    if (!opt) return { reply: `No te he entendido. ${ask(c.step)}`, done: false };
    const answers = { ...c.answers, [q.id]: opt.value };
    const next = c.step + 1;
    await save(next, answers);
    return { reply: next < NAME ? ask(next) : "¡Gracias! Para darte el resultado, ¿cómo te llamas?", done: false };
  }
  if (c.step === NAME) {
    const name = text.trim().replace(/\s+/g, " ").slice(0, 120);
    if (name.length < 2) return { reply: "¿Cómo te llamas?", done: false };
    await save(PROVINCE, { ...c.answers, name });
    return { reply: `Gracias, ${name.split(" ")[0]}. ¿En qué provincia vives?`, done: false };
  }
  if (c.step === PROVINCE) {
    const province = matchProvince(text);
    if (!province) return { reply: "No reconozco esa provincia. Escríbela de nuevo, por ejemplo: *Valencia*.", done: false };
    await save(CONSENT, { ...c.answers, province });
    const privacy = `${appUrl()}/privacidad${firm ? `?d=${input.client_code}` : ""}`;
    return {
      reply: `Último paso. Para que un abogado estudie tu caso necesitamos tu permiso:\n\n_${firm ? FIRM_CONSENT_TEXT(firm.name) : CONSENT_TEXT(brand)}_\n\nPolítica de privacidad: ${privacy}\n\nResponde *SÍ* para aceptar.`,
      done: false,
    };
  }
  if (c.step === CONSENT) {
    if (!/^(si|vale|acepto|ok|de acuerdo)\b/.test(t)) {
      return { reply: "Sin tu permiso no podemos pasar tu caso a un abogado. Si cambias de idea, responde *SÍ*.", done: false };
    }
    const code = firm ? input.client_code! : undefined;
    const r = await submitTest({
      answers: Object.fromEntries(QUESTIONS.map((q) => [q.id, c!.answers[q.id]])) as TestAnswers,
      full_name: c.answers.name, phone, province: c.answers.province, consent: true, marketing_ok: false,
      utm: { utm_source: "whatsapp", utm_medium: "asistente", utm_campaign: "whatsapp-24h" }, client_code: code,
    });
    if (!r.ok) return { reply: `Ha habido un problema: ${r.error} Escribe *empezar* para intentarlo de nuevo.`, done: false };
    await save(DONE, c.answers, true);
    return {
      reply: `*${r.verdict.title}*\n\n${r.verdict.text}\n\nUn especialista te llamará en breve (lunes a sábado, de 9 a 21 h) a este mismo número. Ten a mano un resumen de lo que debes y a quién.`,
      done: true,
    };
  }
  return { reply: "Escribe *empezar* para hacer el test.", done: false };
}
