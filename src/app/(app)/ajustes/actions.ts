"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { query } from "@/lib/db";
import { saveContactInfo } from "@/lib/settings";
import { saveAnthropicKey } from "@/lib/services/clientAi";

export async function createUser(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "caller";
  if (!name || !email || password.length < 8) throw new Error("Nombre, email y contraseña (mín. 8) obligatorios");
  await query(
    `INSERT INTO users(name, email, password_hash, role) VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO UPDATE SET name = $1, password_hash = $3, role = $4, active = true`,
    [name, email, await hashPassword(password), role],
  );
  revalidatePath("/ajustes");
}

export async function toggleUser(id: string) {
  const me = await requireAdmin();
  if (id === me.id) return;
  await query("UPDATE users SET active = NOT active WHERE id = $1", [id]);
  revalidatePath("/ajustes");
}

export async function saveContact(formData: FormData) {
  await requireAdmin();
  await saveContactInfo({
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    brand: String(formData.get("brand") ?? ""),
    legal: String(formData.get("legal") ?? ""),
  });
  revalidatePath("/ajustes");
}

export async function saveAiKey(formData: FormData) {
  await requireAdmin();
  const key = String(formData.get("key") ?? "").trim();
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key)) throw new Error("La clave de Claude empieza por sk-ant-");
  await saveAnthropicKey(key);
  revalidatePath("/ajustes");
  revalidatePath("/clientes", "layout");
}
