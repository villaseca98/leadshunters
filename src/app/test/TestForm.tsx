"use client";
import { useState, useTransition } from "react";
import type { Question, TestAnswers, Verdict } from "@/lib/lsoTest";
import { sendTest } from "./actions";

const field =
  "block min-h-12 w-full rounded-2xl border-0 bg-white px-4 text-base text-ink ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blaze focus:outline-none";

export function TestForm({ questions, provinces, consentText, utm, code, privacyHref = "/privacidad", privacyNote }: { questions: Question[]; provinces: string[]; consentText: string; utm: Record<string, string>; code?: string; privacyHref?: string; privacyNote?: string }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<TestAnswers>>({});
  const [error, setError] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [pending, start] = useTransition();
  const total = questions.length + 1;

  if (verdict) {
    const tone = verdict.kind === "apto" ? "bg-moss text-white" : verdict.kind === "revisar" ? "bg-blaze text-blaze-ink" : "bg-ink text-white";
    return (
      <section className="mt-6 space-y-4" aria-live="polite">
        <div className={`rounded-[1.75rem] p-6 ${tone}`}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">Tu resultado</div>
          <h1 className="font-display mt-2 text-2xl font-semibold leading-tight">{verdict.title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed opacity-90">{verdict.text}</p>
        </div>
        <div className="rounded-[1.75rem] bg-white p-5 text-[15px] leading-relaxed text-slate-700 ring-1 ring-slate-200">
          <div className="font-semibold text-ink">¿Y ahora qué?</div>
          <p className="mt-1">Te llamaremos en unos minutos (de lunes a sábado, de 9 a 21 h) para revisar tu caso y, si encaja, que un abogado colegiado lo estudie contigo en una consulta gratuita.</p>
          <p className="mt-2 text-sm text-slate-500">Ten a mano un resumen de lo que debes y a quién.</p>
        </div>
      </section>
    );
  }

  const q = questions[step];
  const choose = (value: string) => {
    setAnswers((a) => ({ ...a, [q.id]: value }));
    setStep((s) => s + 1);
  };

  const submit = (fd: FormData) => {
    setError("");
    start(async () => {
      const r = await sendTest({
        answers: answers as TestAnswers,
        full_name: String(fd.get("full_name") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        email: String(fd.get("email") ?? ""),
        province: String(fd.get("province") ?? ""),
        consent: fd.get("consent") === "1",
        marketing_ok: fd.get("marketing_ok") === "1",
        website: String(fd.get("website") ?? ""),
        utm,
        client_code: code,
      });
      if (r.ok) {
        setVerdict(r.verdict);
        window.scrollTo({ top: 0 });
      } else setError(r.error);
    });
  };

  return (
    <section className="mt-5">
      <div className="flex items-center gap-3">
        {step > 0 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-lg ring-1 ring-slate-200" aria-label="Atrás">
            ←
          </button>
        )}
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
          <div className="h-full rounded-full bg-blaze transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
        <span className="num text-xs text-slate-500">{step + 1}/{total}</span>
      </div>

      {step === 0 && (
        <div className="mt-6">
          <h1 className="font-display text-3xl font-semibold leading-tight">¿Puedes cancelar tus deudas?</h1>
          <p className="mt-2 text-[15px] text-slate-600">{questions.length} preguntas, 2 minutos. Gratis y sin compromiso.</p>
        </div>
      )}

      {q ? (
        <div className="mt-6">
          <h2 className="text-xl font-semibold leading-snug">{q.title}</h2>
          {q.hint && <p className="mt-1 text-sm text-slate-500">{q.hint}</p>}
          <div className="mt-4 grid gap-2.5">
            {q.options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => choose(o.value)}
                className={`min-h-14 rounded-2xl bg-white px-5 text-left text-base font-medium ring-1 transition active:scale-[0.99] ${answers[q.id] === o.value ? "ring-2 ring-blaze" : "ring-slate-200 hover:ring-slate-300"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form action={submit} className="mt-6 space-y-3">
          <h2 className="text-xl font-semibold leading-snug">¿Dónde te enviamos el resultado?</h2>
          <p className="text-sm text-slate-500">Lo ves al momento y te llamamos para revisarlo contigo.</p>
          <input name="full_name" autoComplete="name" required placeholder="Nombre" className={field} />
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="Teléfono móvil" className={field} />
          <input name="email" type="email" autoComplete="email" placeholder="Email (opcional)" className={field} />
          <select name="province" required defaultValue="" className={field}>
            <option value="" disabled>Provincia</option>
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <label className="flex gap-3 rounded-2xl bg-white p-4 text-sm leading-snug text-slate-700 ring-1 ring-slate-200">
            <input type="checkbox" name="consent" value="1" required className="mt-0.5 size-5 shrink-0 accent-[var(--color-blaze)]" />
            <span>{consentText} <a href={privacyHref} target="_blank" className="underline">Ver política</a></span>
          </label>
          <label className="flex gap-3 px-1 text-sm leading-snug text-slate-500">
            <input type="checkbox" name="marketing_ok" value="1" className="mt-0.5 size-5 shrink-0 accent-[var(--color-blaze)]" />
            <span>Quiero recibir avisos y consejos sobre mis deudas por WhatsApp (opcional).</span>
          </label>
          {privacyNote && (
            <p className="px-1 text-xs leading-relaxed text-slate-500">
              {privacyNote} <a href={privacyHref} target="_blank" className="underline">Más información</a>
            </p>
          )}
          {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <button disabled={pending} className="min-h-14 w-full rounded-full bg-blaze px-6 text-base font-semibold text-blaze-ink disabled:opacity-60">
            {pending ? "Calculando…" : "Ver mi resultado"}
          </button>
        </form>
      )}
    </section>
  );
}
