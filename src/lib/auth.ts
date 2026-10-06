import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { queryOne } from "./db";
import { secretSetting } from "./settings";

export type User = { id: string; name: string; email: string; role: "admin" | "caller" };

const COOKIE = "lh_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 días

async function sign(value: string) {
  return createHmac("sha256", await secretSetting("SESSION_SECRET")).update(value).digest("base64url");
}

async function encode(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const body = `${userId}.${exp}`;
  return `${body}.${await sign(body)}`;
}

async function decode(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  const expected = await sign(`${id}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return id;
}

export async function getUser(): Promise<User | null> {
  const jar = await cookies();
  const id = await decode(jar.get(COOKIE)?.value);
  if (!id) return null;
  return queryOne<User>("SELECT id, name, email, role FROM users WHERE id = $1 AND active", [id]);
}

export async function requireUser(): Promise<User> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "admin") redirect("/");
  return u;
}

export async function login(email: string, password: string): Promise<boolean> {
  const u = await queryOne<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE lower(email) = lower($1) AND active",
    [email.trim()],
  );
  if (!u) return false;
  // en móvil el teclado a veces añade un espacio al final: se acepta la contraseña con o sin él
  const ok = (await bcrypt.compare(password, u.password_hash)) || (password.trim() !== password && (await bcrypt.compare(password.trim(), u.password_hash)));
  if (!ok) return false;
  await startSession(u.id);
  return true;
}

async function startSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, await encode(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true" || !!process.env.VERCEL,
    maxAge: MAX_AGE,
    path: "/",
  });
}

/** ¿Está la app recién instalada, sin ningún usuario? */
export async function needsSetup(): Promise<boolean> {
  const r = await queryOne<{ n: number }>("SELECT count(*)::int n FROM users");
  return (r?.n ?? 0) === 0;
}

/** Crea el primer administrador (solo si aún no hay usuarios) e inicia su sesión. */
export async function createFirstAdmin(name: string, email: string, password: string): Promise<boolean> {
  const hash = await bcrypt.hash(password, 10);
  const u = await queryOne<{ id: string }>(
    `INSERT INTO users(name, email, password_hash, role)
     SELECT $1, lower($2), $3, 'admin' WHERE NOT EXISTS (SELECT 1 FROM users)
     RETURNING id`,
    [name.trim() || "Administrador", email.trim(), hash],
  );
  if (!u) return false;
  await startSession(u.id);
  return true;
}

export async function logout() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
