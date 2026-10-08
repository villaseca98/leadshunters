import { test } from "node:test";
import assert from "node:assert/strict";
import { energyPriority, parseBill, parseCustomerType, parsePropertyOption, parseVertical } from "../src/lib/energia";
import { reportInsights, reportText } from "../src/lib/insights";
import type { EnergyReport, Report } from "../src/lib/services/reports";

test("línea de negocio", () => {
  assert.equal(parseVertical("LUZ"), "luz");
  assert.equal(parseVertical("Factura de la luz"), "luz");
  assert.equal(parseVertical("placas solares"), "placas");
  assert.equal(parseVertical("Autoconsumo"), "placas");
  assert.equal(parseVertical("deudas"), "despachos");
  assert.equal(parseVertical(""), null);
  assert.equal(parseVertical("coches"), null);
});

test("factura y vivienda desde botones de ManyChat", () => {
  assert.equal(parseBill("Entre 100 y 200 €"), 150);
  assert.equal(parseBill("3"), 150);
  assert.equal(parseBill("unos 85€"), 85);
  assert.equal(parseBill(""), null);
  assert.equal(parsePropertyOption("Casa o chalet"), "casa");
  assert.equal(parsePropertyOption("3"), "piso");
  assert.equal(parsePropertyOption("nave industrial"), "negocio");
  assert.equal(parseCustomerType("", "negocio"), "negocio");
  assert.equal(parseCustomerType("particular"), "hogar");
});

test("prioridad de luz y placas", () => {
  assert.equal(energyPriority({ vertical: "luz", monthly_bill: 150, property_type: null, owner: null, customer_type: "hogar" }).tier, "A");
  assert.equal(energyPriority({ vertical: "luz", monthly_bill: 40, property_type: null, owner: null, customer_type: "hogar" }).tier, "C");
  assert.equal(energyPriority({ vertical: "luz", monthly_bill: 60, property_type: null, owner: null, customer_type: "negocio" }).tier, "A");
  assert.equal(energyPriority({ vertical: "placas", monthly_bill: 120, property_type: "casa", owner: true, customer_type: "hogar" }).tier, "A");
  assert.equal(energyPriority({ vertical: "placas", monthly_bill: 200, property_type: "piso", owner: true, customer_type: "hogar" }).tier, "C");
  assert.equal(energyPriority({ vertical: "placas", monthly_bill: 200, property_type: "casa", owner: false, customer_type: "hogar" }).tier, "C");
});

const energy = (v: "luz" | "placas", o: Partial<EnergyReport> = {}): EnergyReport => ({
  vertical: v, leads: 0, prev_leads: 0, contactados: 0, speed_min: null, estudios: 0, contratados: 0, contratados_de_mes: 0, comision: 0,
  prev_comision: 0, sin_llamar_24h: 0, priority: [], channels: [], campaigns: [], provinces: [], lost: [], ...o,
});

test("informe: detecta lo que falla y resume", () => {
  const r: Report = {
    month: "2026-10",
    despachos: {
      leads: 20, prev_leads: 40, tests: 30, sin_despacho: 4, cualificados: 12, contactados: 8, speed_min: 42, citas: 8, asistidas: 4, no_asistio: 3,
      facturacion: 1500, clientes_activos: 2, llamadas_b2b: 40, prospectos_interesados: 3, clientes_nuevos: 1,
      campaigns: [{ key: "reel-mitos", leads: 12, won: 0 }], provinces: [],
    },
    luz: energy("luz", { leads: 10, prev_leads: 2, contactados: 8, contratados: 2, comision: 120, sin_llamar_24h: 2, priority: [{ key: "C", leads: 6, won: 0 }] }),
    placas: energy("placas"),
    weeks: [],
  };
  const ins = reportInsights(r);
  const all = ins.map((i) => i.text).join("\n");
  assert.match(all, /−50 %/);
  assert.match(all, /42 min/);
  assert.match(all, /reel-mitos/);
  assert.match(all, /más de 24 h/);
  assert.match(all, /PLACAS/);
  assert.match(all, /Ingreso por lead/);
  const txt = reportText(r, "octubre de 2026", ins);
  assert.match(txt, /Luz: 10 leads/);
  assert.match(txt, /Para mejorar/);
});
