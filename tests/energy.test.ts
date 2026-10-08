import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoAccepted, cleanEnergyData, energyVariable, nextStages, parseRoof, parseShare, parseTariff, qualifyEnergyLead,
} from "../src/lib/energy";

const luz = { vertical: "luz" as const, min_monthly_bill: null, provinces: [] as string[] };
const placas = { vertical: "placas" as const, min_monthly_bill: null, provinces: [] as string[] };

test("tarifa y cubierta en texto libre", () => {
  assert.equal(parseTariff("3.0 TD"), "3.0TD");
  assert.equal(parseTariff("30td"), "3.0TD");
  assert.equal(parseTariff("6.1"), "6.1TD");
  assert.equal(parseTariff("2.0TD"), "2.0TD");
  assert.equal(parseTariff("no sé"), null);
  assert.equal(parseRoof("Es mía, una nave"), "propio");
  assert.equal(parseRoof("De la comunidad de vecinos"), "comunidad");
  assert.equal(parseRoof("Estoy de alquiler"), "alquiler");
  assert.equal(parseRoof("No tengo"), "no");
  assert.equal(parseShare("70 %"), 70);
  assert.equal(parseShare(0.6), 60);
  assert.equal(parseShare("la mayoría de día"), 70);
});

test("datos de energía del formulario de Recorta", () => {
  const e = cleanEnergyData({ factura_mensual: "180,50 €", tarifa: "3.0TD", negocio: "Bar", cp: "29001", cubierta: "propia", consumo_de_dia: "65%", ahorro_estimado: 420 });
  assert.equal(e.monthly_bill, 180.5);
  assert.equal(e.tariff, "3.0TD");
  assert.equal(e.business_type, "Bar");
  assert.equal(e.postal_code, "29001");
  assert.equal(e.roof, "propio");
  assert.equal(e.daytime_share, 65);
  assert.equal(e.estimated_saving, 420);
  assert.equal(cleanEnergyData({ monthly_bill: "1.250" }).monthly_bill, 1250);
});

test("luz: factura alta en 3.0TD cualifica; pequeña no", () => {
  const good = qualifyEnergyLead({ phone: "+34600000000", monthly_bill: 320, tariff: "3.0TD", business_type: "Taller" }, luz);
  assert.equal(good.status, "cualificado");
  assert.ok(good.score >= 55);
  const small = qualifyEnergyLead({ phone: "+34600000000", monthly_bill: 45 }, luz);
  assert.equal(small.status, "no_cualificado");
  const unknown = qualifyEnergyLead({ phone: "+34600000000" }, luz);
  assert.equal(unknown.status, "pendiente");
  const noPhone = qualifyEnergyLead({ monthly_bill: 500 }, luz);
  assert.equal(noPhone.status, "no_cualificado");
});

test("placas: sin cubierta no vale; fuera de zona del instalador tampoco", () => {
  const good = qualifyEnergyLead({ phone: "+34600000000", monthly_bill: 250, roof: "propio", daytime_share: 70 }, placas);
  assert.equal(good.status, "cualificado");
  assert.equal(qualifyEnergyLead({ phone: "+34600000000", monthly_bill: 250, roof: "no" }, placas).status, "no_cualificado");
  const zone = qualifyEnergyLead({ phone: "+34600000000", monthly_bill: 250, roof: "propio", province: "Lugo" }, { ...placas, provinces: ["Málaga"] });
  assert.equal(zone.status, "no_cualificado");
  // luz fuera de zona solo resta
  const luzZone = qualifyEnergyLead({ phone: "+34600000000", monthly_bill: 600, tariff: "6.1TD", province: "Lugo" }, { ...luz, provinces: ["Málaga"] });
  assert.notEqual(luzZone.status, "no_cualificado");
});

test("flujo de etapas", () => {
  assert.deepEqual(nextStages("placas", "enviado"), ["aceptado", "rechazado"]);
  assert.deepEqual(nextStages("luz", "firmado"), ["activado", "perdido"]);
  assert.deepEqual(nextStages("placas", "firmado"), []);
  const t0 = new Date("2026-10-01T10:00:00Z");
  assert.equal(autoAccepted(t0, 72, new Date("2026-10-04T09:59:00Z")), false);
  assert.equal(autoAccepted(t0, 72, new Date("2026-10-04T10:00:00Z")), true);
});

test("cobro de luz y placas", () => {
  const p = energyVariable({ vertical: "placas", price_per_lead: 35, price_per_sale: null, sale_commission_pct: 3, leads_aceptados: 10, ventas: 2, importe_obras: 14000 });
  assert.deepEqual(p, { porLeads: 350, porVentas: 0, porComision: 420, total: 770 });
  const l = energyVariable({ vertical: "luz", price_per_lead: 35, price_per_sale: 60, sale_commission_pct: 3, leads_aceptados: 10, ventas: 4, importe_obras: 0 });
  assert.deepEqual(l, { porLeads: 0, porVentas: 240, porComision: 0, total: 240 });
});
