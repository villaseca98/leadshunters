import { test } from "node:test";
import assert from "node:assert/strict";
import { mapAnswers, normalizePhone, parseCount, parseMoney, provinceFromPostalCode, matchProvince } from "../src/lib/normalize";
import { qualifyLead } from "../src/lib/qualify";
import { scoreProspect } from "../src/lib/scoring";
import { nextRetry, MAX_ATTEMPTS } from "../src/lib/schedule";

const crit = { min_debt: 8000, min_creditors: 2, provinces: [] as string[] };

test("teléfonos españoles", () => {
  assert.equal(normalizePhone("612 34 56 78"), "+34612345678");
  assert.equal(normalizePhone("0034 912345678"), "+34912345678");
  assert.equal(normalizePhone("34612345678"), "+34612345678");
  assert.equal(normalizePhone(""), null);
});

test("importes en texto libre", () => {
  assert.equal(parseMoney("Entre 10.000 y 30.000 €"), 20000);
  assert.equal(parseMoney("Más de 50k"), 50000);
  assert.equal(parseMoney("Menos de 6.000€"), 5999);
  assert.equal(parseMoney("1.200,50 €"), 1200.5);
  assert.equal(parseMoney(15000), 15000);
  assert.equal(parseCount("3 o más"), 3);
  assert.equal(parseCount("dos"), 2);
});

test("provincias", () => {
  assert.equal(provinceFromPostalCode("46004"), "Valencia");
  assert.equal(matchProvince("malaga"), "Málaga");
  assert.equal(matchProvince("Vizcaya"), "Bizkaia");
});

test("mapeo de respuestas de Meta", () => {
  const m = mapAnswers({
    full_name: "María Pérez", phone_number: "612345678", "¿cuánto_debes_en_total?": "Entre 20.000 y 40.000 €",
    "¿con_cuántos_bancos_o_financieras?": "4", "¿cuáles_son_tus_ingresos_mensuales?": "1.200 €", "¿tienes_vivienda_en_propiedad?": "No",
  });
  assert.equal(m.full_name, "María Pérez");
  assert.equal(m.phone, "+34612345678");
  assert.equal(m.debt_amount, 30000);
  assert.equal(m.creditors_count, 4);
  assert.equal(m.monthly_income, 1200);
  assert.equal(m.owns_home, false);
});

test("cualificación LSO", () => {
  const good = qualifyLead({ phone: "+34600000000", debt_amount: 30000, creditors_count: 4, monthly_income: 1200, employment_status: "asalariado", owns_home: false }, crit);
  assert.equal(good.status, "cualificado");
  assert.equal(qualifyLead({ phone: "+34600000000", debt_amount: 30000, creditors_count: 1 }, crit).status, "no_cualificado");
  assert.equal(qualifyLead({ phone: "+34600000000", debt_amount: 5000, creditors_count: 3 }, crit).status, "no_cualificado");
  assert.equal(qualifyLead({ phone: "+34600000000", debt_amount: 30000, creditors_count: 3, prior_lso: true }, crit).status, "no_cualificado");
  assert.equal(qualifyLead({ phone: "+34600000000" }, crit).status, "pendiente");
});

test("puntuación de despachos", () => {
  const top = scoreProspect({ name: "Abogados Segunda Oportunidad", phone: "+34960000000", reviews_count: 80, rating: 4.7, meta_ads_active: true, meta_ads_lso: true });
  assert.equal(top.tier, "A");
  const noPhone = scoreProspect({ name: "Abogados Segunda Oportunidad", reviews_count: 80, rating: 4.7, meta_ads_active: true });
  assert.ok(noPhone.score <= 40);
  const big = scoreProspect({ name: "Bufete X", phone: "1", reviews_count: 3000, rating: 4.9 });
  assert.ok(big.score < top.score);
  assert.ok(scoreProspect({ name: "Despacho Y", phone: "1" }).hooks.length > 0);
});

test("cadencia de rellamadas", () => {
  const from = new Date("2026-10-06T08:00:00Z"); // martes 10:00 en Madrid
  const r1 = nextRetry(1, from)!;
  assert.equal(r1.getTime() - from.getTime(), 10 * 60_000);
  assert.equal(nextRetry(MAX_ATTEMPTS, from), null);
  const night = nextRetry(1, new Date("2026-10-06T19:55:00Z"))!; // 21:55 Madrid -> mañana a las 9
  assert.equal(night.toISOString(), "2026-10-07T07:00:00.000Z");
});

test("auditoría: solo marca lo comprobado", async () => {
  const { buildAudit, auditMessage } = await import("../src/lib/audit");
  const a = buildAudit(
    {
      name: "Bufete Pérez", city: "Valencia", website: "https://x.es", rating: 4.8, reviews_count: 40,
      instagram: null, instagram_days_since_post: null, website_has_form: true, website_has_whatsapp: false,
      website_has_pixel: null, meta_ads_active: null, call_hooks: ["Su web no tiene WhatsApp"],
    },
    { total: 12, con_anuncios: 3, reviews_rank: 4 },
  );
  assert.equal(a.total, 4); // píxel y anuncios sin comprobar no cuentan
  assert.equal(a.passed, 2);
  assert.match(a.reviews!, /puesto 4 de 12/);
  assert.match(a.market!, /3 ya anuncian/);
  const m = auditMessage({ name: "Bufete Pérez", call_hooks: ["Su web no tiene WhatsApp"] }, "https://l/a/1", "Ana");
  assert.match(m.body, /su web no tiene WhatsApp\./);
});

test("test de particulares: resultado y origen", async () => {
  const { evaluateTest, sourceFromUtm, answersToFields } = await import("../src/lib/lsoTest");
  const base = { debt: "22000", creditors: "3", income: "1250", employment: "asalariado", home: "no", blockers: "ninguna" };
  assert.equal(evaluateTest(base).kind, "apto");
  assert.equal(evaluateTest({ ...base, creditors: "1" }).kind, "revisar");
  assert.equal(evaluateTest({ ...base, debt: "5000" }).kind, "revisar");
  assert.equal(evaluateTest({ ...base, blockers: "lso_previa" }).kind, "no_apto");
  assert.equal(answersToFields({ ...base, income: "0" }).monthly_income, 0);
  assert.equal(answersToFields(base).owns_home, false);
  assert.equal(sourceFromUtm("Instagram"), "meta");
  assert.equal(sourceFromUtm("google"), "google");
  assert.equal(sourceFromUtm(null), "web");
});

import { postsForMonth } from "../src/lib/socialPosts";
import { reviewMessage } from "../src/lib/review";

test("12 publicaciones al mes, sin repetir y con el despacho y el enlace", () => {
  const ctx = { firm: "Despacho Test", place: "València", link: "https://x/test/abc" };
  const a = postsForMonth("2026-10", ctx);
  assert.equal(a.length, 12);
  assert.equal(new Set(a.map((p) => p.title)).size, 12);
  assert.ok(a.some((p) => p.caption.includes("https://x/test/abc")));
  assert.ok(a.filter((p) => p.kind !== "historia").every((p) => p.caption.includes("#abogadosvalencia")));
  assert.notEqual(postsForMonth("2026-11", ctx)[0].title, a[0].title);
});

test("mensaje de reseña con el nombre de pila y el enlace", () => {
  const m = reviewMessage("Ana López", "Despacho Test", "https://g.page/r/x");
  assert.ok(m.startsWith("Hola Ana,"));
  assert.ok(m.includes("https://g.page/r/x"));
});
