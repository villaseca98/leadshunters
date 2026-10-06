const TZ = "Europe/Madrid";

export const eur = (n: number | null | undefined, decimals = 0) =>
  n == null ? "—" : n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: decimals, minimumFractionDigits: decimals });

export const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("es-ES"));

export const dateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("es-ES", { timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export const dateOnly = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("es-ES", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }) : "—";

export function ago(d: string | Date | null | undefined) {
  if (!d) return "—";
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  const fut = s < 0;
  const a = Math.abs(s);
  const txt = a < 60 ? `${a} s` : a < 3600 ? `${Math.round(a / 60)} min` : a < 86400 ? `${Math.round(a / 3600)} h` : `${Math.round(a / 86400)} d`;
  return fut ? `en ${txt}` : `hace ${txt}`;
}

/** Para <input type="datetime-local"> en hora de Madrid */
export function toLocalInput(d: Date) {
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
  return p.replace(" ", "T");
}

/** Convierte "2026-10-06T10:30" (hora de Madrid) a Date UTC */
export function fromLocalInput(v: string): Date {
  const [date, time] = v.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time ?? "00:00").split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  // offset de Madrid en ese momento
  const local = new Date(guess.toLocaleString("en-US", { timeZone: TZ }));
  const utc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (local.getTime() - utc.getTime()));
}

export function currentMonth() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
}

export function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function shiftMonth(m: string, delta: number) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export const telHref = (p?: string | null) => (p ? `tel:${p.replace(/\s/g, "")}` : undefined);
export const waHref = (p?: string | null) => (p ? `https://wa.me/${p.replace(/[^\d]/g, "")}` : undefined);

/** Hora actual (los componentes de servidor se renderizan por petición). */
export const nowMs = () => Date.now();
