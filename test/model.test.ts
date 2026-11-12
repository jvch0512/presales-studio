import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateInput, CONTROL_IDS } from "../src/model.js";

const good = () => JSON.parse(readFileSync(new URL("../../samples/northwind-retail.json", import.meta.url), "utf8"));
const errs = (x: unknown) => { const r = validateInput(x); return r.ok ? [] : r.errors; };

test("valid samples pass and unknown optional fields default", () => {
  const r = validateInput(good());
  assert.ok(r.ok);
  const g = good(); delete g.controls.mfa; delete g.lang;
  const r2 = validateInput(g);
  assert.ok(r2.ok && r2.value.controls.mfa === 0 && r2.value.lang === "en");
});

test("every field is validated and errors are reported together", () => {
  const e = errs({ name: "", industry: "mining", employees: 0, revenueEur: -1, cloudShare: 2, incidents3y: 1.5, budgetEur: "x", lang: "fr", regulations: ["X"], controls: { mfa: 5, ghost: 1 } });
  for (const part of ["name", "industry", "employees", "revenueEur", "cloudShare", "incidents3y", "budgetEur", "lang", "regulation", "controls.mfa", "unknown control"]) assert.ok(e.some((m) => m.includes(part)), part);
});

test("non-objects and hostile shapes never throw", () => {
  for (const x of [null, undefined, 1, "s", [], { controls: [] }, { controls: null }, { regulations: "NIS2", controls: {} }]) assert.ok(errs(x).length > 0);
  assert.ok(errs({ ...good(), employees: NaN }).length > 0);
  assert.ok(errs({ ...good(), employees: Infinity }).length > 0);
  assert.ok(errs({ ...good(), __proto__: { x: 1 }, constructor: 1 }).length === 0);
});

test("names are cleaned of control characters and whitespace", () => {
  const r = validateInput({ ...good(), name: "  Acme \u0000\n  Corp  " });
  assert.ok(r.ok && r.value.name === "Acme Corp");
  assert.ok(errs({ ...good(), name: "x".repeat(81) }).length > 0);
});

test("duplicate regulations collapse", () => {
  const r = validateInput({ ...good(), regulations: ["NIS2", "NIS2"] });
  assert.ok(r.ok && r.value.regulations.length === 1);
  assert.equal(CONTROL_IDS.length, 15);
});
