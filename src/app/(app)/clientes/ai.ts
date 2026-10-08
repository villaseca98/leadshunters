"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { aiError, chatTurn, monthReport } from "@/lib/services/clientAi";

export type AiFormState = { error?: string; ok?: number };

const pathFor = (kind: string, id: string) => (kind === "despacho" ? `/clientes/${id}` : `/clientes/l/${id}`);

export async function askClientAi(kind: "despacho" | "linea", id: string, _prev: AiFormState, formData: FormData): Promise<AiFormState> {
  await requireUser();
  const text = String(formData.get("text") ?? "").trim().slice(0, 4000);
  if (!text) return { error: "Escribe algo sobre el cliente." };
  try {
    const r = await chatTurn(kind, id, text);
    if (r.error) return r;
  } catch (e) {
    return { error: aiError(e) };
  }
  revalidatePath(pathFor(kind, id));
  revalidatePath("/clientes");
  return { ok: Date.now() };
}

export async function makeClientReport(kind: "despacho" | "linea", id: string, month: string): Promise<AiFormState> {
  await requireUser();
  try {
    const r = await monthReport(kind, id, month);
    if (r.error) return r;
  } catch (e) {
    return { error: aiError(e) };
  }
  revalidatePath(pathFor(kind, id));
  return { ok: Date.now() };
}
