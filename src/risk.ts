import { ASSUMPTIONS as A, CONTROLS, CONTROL_BY_ID, DOMAINS, Domain } from "./catalog.js";
import type { ClientInput, ControlId, Level, Regulation } from "./model.js";

export type Levels = Record<ControlId, Level>;

export function maturity(levels: Levels, domain?: Domain): number {
  let num = 0;
  let den = 0;
  for (const c of CONTROLS) {
    if (domain && c.domain !== domain) continue;
    num += c.weight * (levels[c.id] / 3);
    den += c.weight;
  }
  return den ? num / den : 0;
}

export function domainMaturity(levels: Levels): Record<Domain, number> {
  return Object.fromEntries(DOMAINS.map((d) => [d, maturity(levels, d)])) as Record<Domain, number>;
}

export function annualProbability(c: ClientInput, levels: Levels): number {
  const m = maturity(levels);
  const p = A.baseAnnualProbability[c.industry] * (A.maturityEffect.intercept - A.maturityEffect.slope * m) * (1 + A.incidentUplift * Math.min(c.incidents3y, 3)) * (1 + A.cloudUplift * c.cloudShare);
  return Math.min(A.probabilityCap, Math.max(0, p));
}

export function singleLoss(c: ClientInput): number {
  const base = Math.min(A.lossCeilingEur, Math.max(A.lossFloorEur, c.revenueEur * A.lossRevenueShare));
  return Math.round(base * (c.regulations.length ? 1 + A.regulatedLossUplift : 1));
}

export function annualLossExpectancy(c: ClientInput, levels: Levels): number {
  return Math.round(annualProbability(c, levels) * singleLoss(c));
}

export interface Cost {
  oneOff: number;
  annual: number; // steady state per year, one-off amortized over 3 years
  firstYear: number;
}

export function initiativeCost(id: ControlId, c: ClientInput, current: Level): Cost {
  const k = CONTROL_BY_ID[id].cost;
  const gap = 3 - current;
  const scale = A.gapCostFloor + (1 - A.gapCostFloor) * (gap / 3);
  const oneOff = Math.round(k.oneOff * scale);
  const recurring = Math.round((k.recurring + k.perEmployee * c.employees) * scale);
  return { oneOff, annual: Math.round(recurring + oneOff / 3), firstYear: oneOff + recurring };
}

const FRAMEWORKS: Regulation[] = ["NIS2", "ISO27001", "ENS", "PCI-DSS"];

/** Weighted share of mapped controls that are at least solid (level 2). Only frameworks the client is subject to. */
export function coverage(c: ClientInput, levels: Levels): { framework: Regulation; pct: number; mapped: number }[] {
  const out: { framework: Regulation; pct: number; mapped: number }[] = [];
  for (const fw of FRAMEWORKS) {
    if (!c.regulations.includes(fw)) continue;
    let num = 0;
    let den = 0;
    let mapped = 0;
    for (const ctl of CONTROLS) {
      if (!ctl.maps[fw]) continue;
      mapped++;
      den += ctl.weight;
      num += ctl.weight * Math.min(levels[ctl.id] / 2, 1);
    }
    out.push({ framework: fw, pct: den ? num / den : 0, mapped });
  }
  return out;
}
