import { test } from "node:test";
import assert from "node:assert/strict";
import { extractData, manychatBody, matchLine, parseOptions, readField, scoreLead, type LineField } from "../src/lib/lineas";
import { reportInsights, reportText } from "../src/lib/insights";
import type { LineReport, Report } from "../src/lib/services/reports";

const factura: LineField = {
  key: "factura", label: "Factura de la luz al mes", type: "select", aliases: ["gasto"],
  options: [
    { label: "Menos de 50 €", value: "40", points: -2 }, { label: "Entre 50 y 100 €", value: "75", points: 1 },
    { label: "Entre 100 y 200 €", value: "150", points: 2 }, { label: "Más de 200 €", value: "250", points: 3 },
  ],
};
const placas = {
  fields: [
    factura,
    { key: "inmueble", label: "¿Dónde vives?", type: "select", aliases: ["vivienda"], options: parseOptions("Casa o chalet=2, Adosado=2, Piso=-5, Negocio o nave=2") },
    { key: "propietario", label: "¿Eres el propietario?", type: "bool", points_yes: 1, points_no: -5 },
  ] as LineField[],
  priority_a: 4, priority_b: 1,
};
const lines = [
  { slug: "despachos", name: "Despachos", keywords: ["deudas", "lso"], active: true },
  { slug: "luz", name: "Luz", keywords: ["luz", "factura", "electricidad"], active: true },
  { slug: "placas", name: "Placas solares", keywords: ["placas", "solar", "fotovoltaica"], active: true },
  { slug: "alarmas", name: "Alarmas", keywords: [], active: false },
];

test("la línea se reconoce por código, nombre o palabra clave", () => {
  assert.equal(matchLine("luz", lines)?.slug, "luz");
  assert.equal(matchLine("Placas Solares", lines)?.slug, "placas");
  assert.equal(matchLine("quiero ahorrar en la factura de la luz", lines)?.slug, "luz");
  assert.equal(matchLine("PLACAS", lines)?.slug, "placas");
  assert.equal(matchLine("deudas", lines)?.slug, "despachos");
  assert.equal(matchLine("alarmas", lines), null); // pausada
  assert.equal(matchLine("coches", lines), null);
});

test("respuestas de botones: texto, valor o número", () => {
  assert.equal(readField(factura, "Entre 100 y 200 €"), "150");
  assert.equal(readField(factura, "3"), "150");
  assert.equal(readField(factura, "250"), "250");
  // un importe de un formulario web cae en el tramo más cercano
  assert.equal(readField(factura, "130"), "150");
  assert.equal(readField(factura, 480), "250");
  assert.equal(readField(placas.fields[2], "Sí"), "si");
  assert.equal(readField(placas.fields[1], "casa"), "casa_o_chalet");
});

test("saca las preguntas de la línea y guarda lo demás", () => {
  const d = extractData(placas.fields, { nombre: "Ana", telefono: "600", gasto: "2", vivienda: "Piso", propietario: "no", acepto: "si", hijos: "2", vacio: "{{campo}}" });
  assert.deepEqual(d, { factura: "75", inmueble: "piso", propietario: "no", hijos: "2" });
});

test("prioridad por puntos", () => {
  assert.equal(scoreLead(placas, { factura: "150", inmueble: "casa_o_chalet", propietario: "si" }).tier, "A");
  assert.equal(scoreLead(placas, { factura: "75", inmueble: "piso", propietario: "si" }).tier, "C");
  assert.equal(scoreLead(placas, { factura: "75" }).tier, "B");
  assert.equal(scoreLead(placas, {}).tier, "B");
  const r = scoreLead(placas, { factura: "250", inmueble: "adosado" });
  assert.equal(r.points, 5);
  assert.match(r.reasons.join(), /Más de 200 €/);
});

test("cuerpo de ManyChat con las preguntas de la línea", () => {
  const b = JSON.parse(manychatBody({ slug: "placas", fields: placas.fields }));
  assert.equal(b.linea, "placas");
  assert.equal(b.inmueble, "{{inmueble}}");
  assert.equal(b.acepto, "si");
});

const lr = (slug: string, o: Partial<LineReport> = {}): LineReport => ({
  line: { id: slug, slug, name: slug === "luz" ? "Luz" : "Placas solares", emoji: "•", company_name: "Recorta", won_label: "Contratado", value_label: "Comisión", proposal_label: "Estudio enviado" },
  leads: 0, prev_leads: 0, contactados: 0, speed_min: null, estudios: 0, contratados: 0, contratados_de_mes: 0, comision: 0,
  prev_comision: 0, sin_llamar_24h: 0, priority: [], channels: [], campaigns: [], provinces: [], lost: [], ...o,
});

test("informe: detecta lo que falla en cada línea y resume", () => {
  const r: Report = {
    month: "2026-10",
    despachos: {
      leads: 20, prev_leads: 40, tests: 30, sin_despacho: 4, cualificados: 12, contactados: 8, speed_min: 42, citas: 8, asistidas: 4, no_asistio: 3,
      facturacion: 1500, clientes_activos: 2, llamadas_b2b: 40, prospectos_interesados: 3, clientes_nuevos: 1,
      campaigns: [{ key: "reel-mitos", leads: 12, won: 0 }], provinces: [],
    },
    lines: [lr("luz", { leads: 10, prev_leads: 2, contactados: 8, contratados: 2, comision: 120, sin_llamar_24h: 2, priority: [{ key: "C", leads: 6, won: 0 }] }), lr("placas")],
    weeks: [],
  };
  const all = reportInsights(r).map((i) => i.text).join("\n");
  assert.match(all, /−50 %/);
  assert.match(all, /42 min/);
  assert.match(all, /reel-mitos/);
  assert.match(all, /más de 24 h/);
  assert.match(all, /PLACAS/);
  assert.match(all, /prioridad C/);
  assert.match(all, /Ingreso por lead/);
  const txt = reportText(r, "octubre de 2026");
  assert.match(txt, /Luz \(Recorta\): 10 leads/);
  assert.match(txt, /Para mejorar/);
});

test("al editar las opciones se conservan los valores que ya existían", () => {
  const prev = [{ label: "Casa o chalet", value: "casa" }];
  assert.deepEqual(parseOptions("Casa o chalet=3, Finca=1", prev), [{ label: "Casa o chalet", value: "casa", points: 3 }, { label: "Finca", value: "finca", points: 1 }]);
});
