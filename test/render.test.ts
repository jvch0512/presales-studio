import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateInput } from "../src/model.js";
import { plan } from "../src/planner.js";
import { renderHtml, renderMarkdown, esc } from "../src/render.js";
import { templateSummary, buildFacts } from "../src/summary.js";
import { CONTROLS } from "../src/catalog.js";

const load = (n: string) => { const r = validateInput(JSON.parse(readFileSync(new URL(`../../samples/${n}`, import.meta.url), "utf8"))); if (!r.ok) throw new Error("bad"); return r.value; };
const doc = (n: string, tweak: object = {}) => { const c = { ...load(n), ...tweak }; const p = plan(c); return { c, p, html: renderHtml(c, p, templateSummary(buildFacts(c, p)), "template") }; };

test("escape helper", () => assert.equal(esc(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;"));

test("the proposal is a complete document without any script", () => {
  const { html } = doc("northwind-retail.json");
  assert.match(html, /^<!doctype html>/);
  assert.ok(!/<script|onerror=|onload=|javascript:/i.test(html));
  for (const part of ["Executive summary", "Recommended initiatives", "Roadmap", "Target architecture", "Assumptions and limits", "NIS2", "PCI-DSS"]) assert.ok(html.includes(part), part);
  assert.equal((html.match(/<svg/g) ?? []).length, 3);
});

test("Spanish proposals use Spanish headings and control names", () => {
  const { html } = doc("clinica-sanitas.json");
  assert.match(html, /lang="es"/);
  for (const part of ["Resumen ejecutivo", "Iniciativas recomendadas", "Arquitectura objetivo", "Autenticación multifactor"]) assert.ok(html.includes(part), part);
  assert.ok(!html.includes("Executive summary"));
});

test("hostile client name and summary are escaped everywhere", () => {
  const evil = '<img src=x onerror=alert(1)>"\'';
  const { html } = doc("northwind-retail.json", { name: evil });
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  const c = load("northwind-retail.json");
  const h2 = renderHtml(c, plan(c), "<script>alert(1)</script>", "claude");
  assert.ok(!h2.includes("<script>alert"));
});

test("every initiative and its price appear in the table", () => {
  const { p, html } = doc("northwind-retail.json");
  for (const i of p.initiatives) {
    const ctl = CONTROLS.find((c) => c.id === i.id)!;
    assert.ok(html.includes(esc(ctl.name.en)), i.id);
    assert.ok(html.includes("€" + i.cost.annual.toLocaleString("en-US")), i.id);
  }
});

test("deferred items explain why, and a zero budget produces a valid empty plan", () => {
  const { html } = doc("northwind-retail.json", { budgetEur: 0 });
  assert.match(html, /outside the annual budget/);
  assert.match(html, /<\/html>$/);
});

test("fully mature client renders without errors", () => {
  const controls = Object.fromEntries(CONTROLS.map((c) => [c.id, 3]));
  const { html } = doc("northwind-retail.json", { controls });
  assert.ok(html.includes("Recommended initiatives"));
});

test("markdown export carries the same totals", () => {
  const c = load("northwind-retail.json");
  const p = plan(c);
  const md = renderMarkdown(c, p, "summary");
  assert.match(md, /^# Cybersecurity proposal: Northwind Retail Group/);
  assert.ok(md.includes("€" + p.totals.annualCost.toLocaleString("en-US")));
  assert.equal(md.split("\n").filter((l) => l.startsWith("| ") && l.includes("€")).length, p.initiatives.length + 2); // KPI row, one row per initiative, total row
});
