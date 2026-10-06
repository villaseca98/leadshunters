import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { queryOne } from "./db";

export type User = { id: string; name: string; email: string; role: "admin" | "caller" };

const COOKIE = "lh_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 días

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("Falta SESSION_SECRET (mínimo 16 caracteres) en el .env");
  return s;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function encode(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const body = `${userId}.${exp}`;
  return `${body}.${sign(body)}`;
}

function decode(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, exp, sig] = parts;
  const expected = sign(`${id}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return id;
}

export async function getUser(): Promise<User | null> {
  const jar = await cookies();
  const id = decode(jar.get(COOKIE)?.value);
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
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return false;
  const jar = await cookies();
  jar.set(COOKIE, encode(u.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true" || !!process.env.VERCEL,
    maxAge: MAX_AGE,
    path: "/",
  });
  return true;
}

export async function logout() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
