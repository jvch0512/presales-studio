import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateInput, ClientInput, CONTROL_IDS, Level } from "../src/model.js";
import { CONTROLS, CONTROL_BY_ID, DOMAINS } from "../src/catalog.js";
import { maturity, domainMaturity, annualProbability, singleLoss, annualLossExpectancy, initiativeCost, coverage } from "../src/risk.js";
import { plan, complianceDriven } from "../src/planner.js";

const load = (n: string): ClientInput => { const r = validateInput(JSON.parse(readFileSync(new URL(`../../samples/${n}`, import.meta.url), "utf8"))); if (!r.ok) throw new Error(r.errors.join()); return r.value; };
const all = (l: Level) => Object.fromEntries(CONTROL_IDS.map((i) => [i, l])) as Record<(typeof CONTROL_IDS)[number], Level>;
const retail = () => load("northwind-retail.json");

test("catalog: weights positive, every control has a cost, a domain and a bilingual name", () => {
  assert.equal(new Set(CONTROLS.map((c) => c.id)).size, CONTROLS.length);
  for (const c of CONTROLS) {
    assert.ok(c.weight > 0 && c.weeks > 0, c.id);
    assert.ok(DOMAINS.includes(c.domain));
    assert.ok(c.name.en && c.name.es && c.why.en && c.why.es);
    assert.ok(c.cost.oneOff + c.cost.recurring + c.cost.perEmployee > 0);
  }
  assert.equal(CONTROL_BY_ID["mfa"].domain, "protect");
});

test("maturity bounds and per-domain split", () => {
  assert.equal(maturity(all(0)), 0);
  assert.equal(maturity(all(3)), 1);
  assert.ok(Math.abs(maturity(all(3)) - 1) < 1e-12);
  const d = domainMaturity(all(2));
  for (const k of DOMAINS) assert.ok(Math.abs(d[k] - 2 / 3) < 1e-12);
});

test("probability falls as maturity rises and respects the cap", () => {
  const c = retail();
  assert.ok(annualProbability(c, all(0)) > annualProbability(c, all(3)));
  const worst = { ...c, incidents3y: 100, cloudShare: 1, industry: "healthcare" as const };
  assert.ok(annualProbability(worst, all(0)) <= 0.85);
  assert.ok(annualProbability({ ...c, incidents3y: 3 }, all(1)) > annualProbability({ ...c, incidents3y: 0 }, all(1)));
  assert.ok(annualProbability({ ...c, cloudShare: 1 }, all(1)) > annualProbability({ ...c, cloudShare: 0 }, all(1)));
});

test("single loss: floor, ceiling and regulated uplift", () => {
  const c = retail();
  assert.equal(singleLoss({ ...c, revenueEur: 100_000, regulations: [] }), 150_000);
  assert.equal(singleLoss({ ...c, revenueEur: 10_000_000_000, regulations: [] }), 12_000_000);
  assert.equal(singleLoss({ ...c, revenueEur: 20_000_000, regulations: [] }), 500_000);
  assert.equal(singleLoss({ ...c, revenueEur: 20_000_000, regulations: ["NIS2"] }), 575_000);
});

test("initiative cost: per-user fees scale and half-built controls are cheaper", () => {
  const c = retail();
  const full = initiativeCost("mfa", c, 0);
  const part = initiativeCost("mfa", c, 2);
  assert.ok(part.annual < full.annual);
  assert.equal(full.oneOff, 4000);
  assert.equal(full.firstYear, 4000 + 45 * c.employees);
  assert.ok(initiativeCost("mfa", { ...c, employees: c.employees * 2 }, 0).annual > full.annual);
  assert.equal(full.annual, Math.round(45 * c.employees + 4000 / 3));
});

test("compliance coverage only lists frameworks the client is subject to", () => {
  const c = retail();
  const cov = coverage({ ...c, regulations: ["NIS2", "GDPR"] }, all(0));
  assert.deepEqual(cov.map((x) => x.framework), ["NIS2"]);
  assert.equal(cov[0]!.pct, 0);
  assert.equal(coverage({ ...c, regulations: ["ISO27001"] }, all(2))[0]!.pct, 1);
  assert.equal(coverage({ ...c, regulations: [] }, all(2)).length, 0);
});

test("plan respects the budget for every client and budget", () => {
  for (const f of ["northwind-retail.json", "clinica-sanitas.json"]) {
    for (const budget of [0, 10_000, 50_000, 120_000, 400_000, 5_000_000]) {
      const c = { ...load(f), budgetEur: budget };
      const p = plan(c);
      assert.ok(p.totals.annualCost <= budget, `${f} ${budget}`);
      assert.equal(p.totals.annualCost, p.initiatives.reduce((a, i) => a + i.cost.annual, 0));
    }
  }
  assert.equal(plan({ ...retail(), budgetEur: 0 }).initiatives.length, 0);
});

test("plan never makes things worse and the numbers add up", () => {
  const c = retail();
  const p = plan(c);
  assert.ok(p.after.maturity >= p.before.maturity);
  assert.ok(p.after.ale < p.before.ale);
  assert.equal(p.totals.aleReduction, p.before.ale - p.after.ale);
  assert.equal(p.totals.net, p.totals.aleReduction - p.totals.annualCost);
  assert.ok(Math.abs(p.totals.roi - p.totals.net / p.totals.annualCost) < 1e-9);
  const sumRed = p.initiatives.reduce((a, i) => a + i.aleReduction, 0);
  assert.ok(Math.abs(sumRed - p.totals.aleReduction) <= p.initiatives.length, "marginal reductions telescope to the total");
  for (const i of p.initiatives) assert.equal(p.levelsAfter[i.id], 3);
});

test("a fully mature client needs nothing", () => {
  const c = { ...retail(), controls: all(3) };
  const p = plan(c);
  assert.equal(p.initiatives.length, 0);
  assert.equal(p.totals.roi, 0);
  assert.equal(p.totals.paybackMonths, null);
});

test("unprofitable controls are only kept when a framework requires them", () => {
  const c = load("clinica-sanitas.json");
  const p = plan(c);
  for (const i of p.initiatives) if (i.driver === "compliance") assert.ok(complianceDriven(i.id, c));
  const noRegs = plan({ ...c, regulations: ["GDPR"] });
  assert.ok(noRegs.initiatives.every((i) => i.driver === "roi"));
  assert.ok(noRegs.deferred.some((d) => d.reason === "roi"));
  assert.ok(noRegs.totals.roi >= 0);
});

test("initiatives are ordered by marginal return and the roadmap is consistent", () => {
  const p = plan(retail());
  for (const i of p.initiatives) {
    assert.ok(i.startWeek >= 0 && i.weeks === CONTROL_BY_ID[i.id].weeks);
    assert.equal(i.phase, i.startWeek < 13 ? 1 : i.startWeek < 26 ? 2 : 3);
  }
  assert.equal(p.initiatives[0]!.startWeek, 0);
  assert.ok(p.initiatives.some((i) => i.startWeek === 0 && i !== p.initiatives[0]), "two lanes start in parallel");
});

test("deferred list plus chosen covers every control below level 3", () => {
  const c = { ...retail(), budgetEur: 60_000 };
  const p = plan(c);
  const gaps = CONTROL_IDS.filter((i) => c.controls[i] < 3);
  assert.deepEqual([...p.initiatives.map((i) => i.id), ...p.deferred.map((d) => d.id)].sort(), [...gaps].sort());
  assert.ok(p.deferred.some((d) => d.reason === "budget"));
});
