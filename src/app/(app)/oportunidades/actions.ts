"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { stageExtra } from "@/lib/dealForm";
import { emitDealEvent, setDealStage } from "@/lib/services/deals";

export async function moveDeal(id: string, leadId: string, formData: FormData) {
  await requireUser();
  const stage = String(formData.get("stage") ?? "");
  await setDealStage(id, stage, "equipo", stageExtra(formData));
  revalidatePath("/oportunidades");
  revalidatePath(`/leads/${leadId}`);
}

/** Vuelve a mandar el aviso al instalador o comercializadora (n8n). */
export async function resendDeal(id: string, leadId: string) {
  await requireUser();
  await emitDealEvent("oportunidad.nueva", id);
  revalidatePath(`/leads/${leadId}`);
}
