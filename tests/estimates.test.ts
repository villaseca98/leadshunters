import { test } from "node:test";
import assert from "node:assert/strict";
import { estimate } from "../src/lib/estimates";

test("luz: gasto anual y ahorro a partir de la factura", () => {
  const e = estimate("luz", { factura: "150" }, {});
  assert.equal(e[0].value, "1800 €");
  assert.match(e[1].value, /180 € – 360 €/);
});

test("placas: dimensiona por consumo y limita por superficie", () => {
  const free = estimate("placas", {}, { consumo_anual_kwh: "6000", orientacion: "sur" });
  assert.equal(free[0].value, "3 kWp");
  const small = estimate("placas", {}, { consumo_anual_kwh: "6000", superficie_m2: "10" });
  assert.equal(small[0].value, "2 kWp");
});

test("web: importe por presupuesto o por páginas", () => {
  assert.equal(estimate("web", { presupuesto: "1000" }, {})[0].value, "1000 €");
  assert.equal(estimate("web", {}, { paginas: "4" })[0].value, "1000 €");
  assert.deepEqual(estimate("web", {}, {}), []);
});
