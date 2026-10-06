"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { fromLocalInput } from "@/lib/format";
import { setConsultationStatus } from "@/lib/services/leads";

export async function markConsultation(id: string, status: "asistida" | "no_asistio" | "cancelada" | "agendada") {
  await requireUser();
  await setConsultationStatus(id, status, "equipo");
  revalidatePath("/citas");
}

export async function reschedule(id: string, formData: FormData) {
  await requireUser();
  const v = String(formData.get("scheduled_at") ?? "");
  if (!v) return;
  await query("UPDATE consultations SET scheduled_at = $2, status = 'agendada', reminder_sent_at = NULL, updated_at = now() WHERE id = $1", [
    id, fromLocalInput(v).toISOString(),
  ]);
  revalidatePath("/citas");
}
