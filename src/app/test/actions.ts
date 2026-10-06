"use server";
import { submitTest, type TestSubmission } from "@/lib/services/testLeads";

export async function sendTest(s: TestSubmission & { website?: string }) {
  if (s.website) return { ok: true as const, verdict: { kind: "revisar" as const, title: "Gracias", text: "Te llamaremos pronto." } }; // trampa para bots
  try {
    return await submitTest(s);
  } catch (e) {
    console.error("test", e);
    return { ok: false as const, error: "No hemos podido guardar tus respuestas. Inténtalo de nuevo en un momento." };
  }
}
