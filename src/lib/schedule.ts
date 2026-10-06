// Horarios de rellamada en hora de Madrid (L-V 9:00-21:00, S 10:00-14:00).
const TZ = "Europe/Madrid";

function madridParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { wd: get("weekday"), h: parseInt(get("hour"), 10), m: parseInt(get("minute"), 10) };
}

function isCallable(d: Date) {
  const { wd, h } = madridParts(d);
  if (wd === "Sun") return false;
  if (wd === "Sat") return h >= 10 && h < 14;
  return h >= 9 && h < 21;
}

/** Avanza en pasos de 15 min hasta caer en horario de llamadas. */
export function toCallableTime(d: Date): Date {
  if (isCallable(d)) return new Date(d);
  let t = new Date(d);
  for (let i = 0; i < 4 * 24 * 4 && !isCallable(t); i++) t = new Date(t.getTime() + 15 * 60_000);
  // al abrir la franja, ajustamos a la hora en punto (9:00, 10:00)
  const { m } = madridParts(t);
  return new Date(t.getTime() - m * 60_000 - t.getUTCSeconds() * 1000 - t.getUTCMilliseconds());
}

// Cadencia tras "no contesta": 10 min, 1 h, 3 h, día siguiente, +2 días, +3 días.
const CADENCE_MIN = [10, 60, 180, 60 * 20, 60 * 48, 60 * 72];
export const MAX_ATTEMPTS = CADENCE_MIN.length + 1;

export function nextRetry(attempts: number, from = new Date()): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const mins = CADENCE_MIN[Math.min(attempts - 1, CADENCE_MIN.length - 1)];
  return toCallableTime(new Date(from.getTime() + mins * 60_000));
}
