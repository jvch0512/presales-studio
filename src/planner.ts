import { CONTROL_BY_ID, CONTROLS } from "./catalog.js";
import type { ClientInput, ControlId } from "./model.js";
import { annualLossExpectancy, coverage, domainMaturity, initiativeCost, Levels, maturity, Cost } from "./risk.js";

export interface Initiative {
  id: ControlId;
  driver: "roi" | "compliance"; // compliance: not profitable on loss reduction alone, but required by a framework the client is subject to
  from: number;
  cost: Cost;
  aleReduction: number; // marginal, given everything chosen before it
  net: number; // reduction minus annual cost
  roi: number; // net / annual cost
  paybackMonths: number | null;
  phase: 1 | 2 | 3;
  startWeek: number;
  weeks: number;
}

export interface Plan {
  initiatives: Initiative[];
  deferred: { id: ControlId; reason: "budget" | "no-benefit" | "roi" }[];
  before: { maturity: number; ale: number; domains: ReturnType<typeof domainMaturity>; coverage: ReturnType<typeof coverage> };
  after: { maturity: number; ale: number; domains: ReturnType<typeof domainMaturity>; coverage: ReturnType<typeof coverage> };
  totals: { annualCost: number; firstYear: number; oneOff: number; aleReduction: number; net: number; roi: number; paybackMonths: number | null };
  levelsAfter: Levels;
}

export function complianceDriven(id: ControlId, c: ClientInput): boolean {
  const maps = CONTROL_BY_ID[id].maps;
  return c.regulations.some((r) => r !== "GDPR" && !!maps[r]);
}

/**
 * Greedy selection by marginal ROI within the annual budget. After each pick the loss model is re-evaluated,
 * so controls that overlap in value (MFA then PAM, say) are not double counted.
 */
export function plan(c: ClientInput): Plan {
  const levels: Levels = { ...c.controls };
  const startLevels: Levels = { ...c.controls };
  const startAle = annualLossExpectancy(c, startLevels);
  const chosen: Initiative[] = [];
  const remaining = new Set(CONTROLS.filter((x) => levels[x.id] < 3).map((x) => x.id));
  const deferred: Plan["deferred"] = [];
  let spent = 0;
  let ale = startAle;

  for (;;) {
    let best: { id: ControlId; cost: Cost; red: number; score: number } | null = null;
    for (const id of remaining) {
      const cost = initiativeCost(id, c, levels[id]);
      if (spent + cost.annual > c.budgetEur) continue;
      const after = annualLossExpectancy(c, { ...levels, [id]: 3 });
      const red = ale - after;
      if (red <= 0) continue;
      if (red < cost.annual && !complianceDriven(id, c)) continue; // not worth it economically and not mandated
      const score = red / Math.max(cost.annual, 1);
      if (!best || score > best.score) best = { id, cost, red, score };
    }
    if (!best) break;
    const from = levels[best.id];
    levels[best.id] = 3;
    remaining.delete(best.id);
    spent += best.cost.annual;
    ale -= best.red;
    const net = best.red - best.cost.annual;
    chosen.push({
      id: best.id, driver: best.red >= best.cost.annual ? "roi" : "compliance", from, cost: best.cost, aleReduction: best.red, net,
      roi: net / Math.max(best.cost.annual, 1),
      paybackMonths: best.red > 0 ? Math.round((best.cost.firstYear / best.red) * 12 * 10) / 10 : null,
      phase: 1, startWeek: 0, weeks: CONTROL_BY_ID[best.id].weeks,
    });
  }
  for (const id of remaining) {
    const afterRed = annualLossExpectancy(c, startLevels) - annualLossExpectancy(c, { ...startLevels, [id]: 3 });
    const cost = initiativeCost(id, c, startLevels[id]);
    deferred.push({ id, reason: afterRed <= 0 ? "no-benefit" : afterRed < cost.annual && !complianceDriven(id, c) ? "roi" : "budget" });
  }

  // Roadmap: two parallel workstreams, highest ROI first. Phase 1 = first 13 weeks, phase 2 = up to week 26, phase 3 = the rest.
  const lanes = [0, 0];
  for (const i of chosen) {
    const lane = lanes[0]! <= lanes[1]! ? 0 : 1;
    i.startWeek = lanes[lane]!;
    lanes[lane] = i.startWeek + i.weeks;
    i.phase = i.startWeek < 13 ? 1 : i.startWeek < 26 ? 2 : 3;
  }

  const sum = (f: (i: Initiative) => number) => chosen.reduce((a, i) => a + f(i), 0);
  const annualCost = sum((i) => i.cost.annual);
  const firstYear = sum((i) => i.cost.firstYear);
  const aleAfter = annualLossExpectancy(c, levels);
  const reduction = startAle - aleAfter;
  return {
    initiatives: chosen,
    deferred,
    before: { maturity: maturity(startLevels), ale: startAle, domains: domainMaturity(startLevels), coverage: coverage(c, startLevels) },
    after: { maturity: maturity(levels), ale: aleAfter, domains: domainMaturity(levels), coverage: coverage(c, levels) },
    totals: {
      annualCost, firstYear, oneOff: sum((i) => i.cost.oneOff), aleReduction: reduction,
      net: reduction - annualCost,
      roi: annualCost > 0 ? (reduction - annualCost) / annualCost : 0,
      paybackMonths: reduction > 0 ? Math.round((firstYear / reduction) * 12 * 10) / 10 : null,
    },
    levelsAfter: levels,
  };
}
