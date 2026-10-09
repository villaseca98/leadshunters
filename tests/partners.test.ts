import { test } from "node:test";
import assert from "node:assert/strict";
import { billBucket, codeFromName, normalizeCode, parseUtm, partnerLink, planWebForm, quarterOf, shareOf } from "../src/lib/partners";

test("códigos de partner: normaliza y rechaza lo raro", () => {
  assert.equal(normalizeCode(" gestoria-perez "), "GESTORIA-PEREZ");
  assert.equal(normalizeCode("a"), null);
  assert.equal(normalizeCode("<b>"), null);
  assert.equal(codeFromName("Gestoría Pérez, S.L."), "GESTORIA-PEREZ");
  assert.equal(codeFromName("Administración de Fincas Núñez y Asociados SLP"), "ADMINISTRACION-DE-FINCAS");
  assert.equal(codeFromName("·"), "PARTNER");
});

test("reparto, trimestres y enlace", () => {
  assert.equal(shareOf(60, 20), 12);
  assert.equal(shareOf(33.33, 20), 6.67);
  assert.equal(shareOf(null, 20), 0);
  assert.equal(quarterOf("2026-10-09T10:00:00Z"), "2026-T4");
  assert.equal(quarterOf("2026-03-31T10:00:00Z"), "2026-T1");
  assert.equal(partnerLink("https://recorta.es/", "GP-1"), "https://recorta.es/revisar-factura/?p=GP-1");
});

test("utm y factura mensual", () => {
  assert.deepEqual(parseUtm("utm_source=meta&utm_campaign=bares&fbclid=x"), { utm_source: "meta", utm_campaign: "bares" });
  assert.deepEqual(parseUtm(undefined), {});
  assert.equal(billBucket("180"), "150");
  assert.equal(billBucket("1200"), "250");
  assert.equal(billBucket("45 €"), "40");
  assert.equal(billBucket(""), null);
});

test("formulario web: luz+placas da dos leads con partner y utm", () => {
  const plan = planWebForm({
    nombre: "Paco Bar", telefono: "600 123 123", email: "", codigoPostal: "28001", sector: "Bar", facturaMensual: "320",
    interes: "luz+placas", tipo: "negocio", utm: "utm_source=meta&utm_campaign=bares", partner: "gp-1", consentimiento: true, web: "",
  });
  assert.equal(plan.kind, "leads");
  if (plan.kind !== "leads") return;
  assert.deepEqual(plan.forms, ["recorta-luz", "recorta-placas"]);
  assert.equal(plan.body.partner, "GP-1");
  assert.equal(plan.body.factura, "250");
  assert.equal(plan.body.campaign, "web-bares");
  assert.equal(plan.body.business_type, "Bar");
  assert.ok(!("email" in plan.body));
});

test("formulario web: trampa, consentimiento y solicitudes de partner", () => {
  assert.equal(planWebForm({ nombre: "Bot", web: "http://spam", consentimiento: true }).kind, "spam");
  assert.equal(planWebForm({ nombre: "Ana", telefono: "600123123" }).kind, "invalid");
  const pro = planWebForm({ nombre: "Gestoría Ruiz", email: "a@b.es", tipo: "profesional", interes: "colaborar", sector: "200 autónomos", consentimiento: "on" });
  assert.equal(pro.kind, "partner");
  if (pro.kind === "partner") { assert.equal(pro.partnerKind, "gestoria"); assert.match(pro.notes, /Cartera: 200/); }
  const inst = planWebForm({ nombre: "Solar Toni", telefono: "600123123", tipo: "instalador", consentimiento: true });
  assert.equal(inst.kind === "partner" && inst.partnerKind, "instalador");
  const sin = planWebForm({ nombre: "Ana", telefono: "600123123", consentimiento: true });
  assert.equal(sin.kind === "leads" && sin.forms.join(), "recorta-luz");
});
