export type Lang = "en" | "es";
export type Level = 0 | 1 | 2 | 3; // none, partial, solid, mature
export const INDUSTRIES = ["healthcare", "finance", "retail", "manufacturing", "public", "services", "technology"] as const;
export type Industry = (typeof INDUSTRIES)[number];
export const REGULATIONS = ["NIS2", "ISO27001", "ENS", "GDPR", "PCI-DSS"] as const;
export type Regulation = (typeof REGULATIONS)[number];

export const CONTROL_IDS = ["assets", "vulnmgmt", "pentest", "mfa", "pam", "emailsec", "awareness", "segmentation", "websec", "edr", "siem", "irplan", "retainer", "backup", "drplan"] as const;
export type ControlId = (typeof CONTROL_IDS)[number];

export interface ClientInput {
  name: string;
  industry: Industry;
  employees: number;
  revenueEur: number;
  regulations: Regulation[];
  cloudShare: number; // 0..1 of workloads in cloud or SaaS
  incidents3y: number;
  budgetEur: number; // annual budget available for security improvements
  lang: Lang;
  controls: Record<ControlId, Level>;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

/** Strict validation of untrusted JSON. Never throws. */
export function validateInput(raw: unknown): Result<ClientInput> {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, errors: ["body must be a JSON object"] };
  const r = raw as Record<string, unknown>;
  const num = (k: string, min: number, max: number, int = false): number => {
    const v = r[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) {
      errors.push(`${k} must be ${int ? "an integer" : "a number"} between ${min} and ${max}`);
      return min;
    }
    return v;
  };
  const name = typeof r["name"] === "string" ? clean(r["name"]) : "";
  if (name.length < 2 || name.length > 80) errors.push("name must be 2 to 80 characters");
  const industry = r["industry"];
  if (typeof industry !== "string" || !(INDUSTRIES as readonly string[]).includes(industry)) errors.push(`industry must be one of ${INDUSTRIES.join(", ")}`);
  const employees = num("employees", 1, 1_000_000, true);
  const revenueEur = num("revenueEur", 10_000, 100_000_000_000);
  const cloudShare = num("cloudShare", 0, 1);
  const incidents3y = num("incidents3y", 0, 100, true);
  const budgetEur = num("budgetEur", 0, 1_000_000_000);
  const lang = r["lang"] === "es" ? "es" : r["lang"] === undefined || r["lang"] === "en" ? "en" : (errors.push("lang must be en or es"), "en");
  const regs: Regulation[] = [];
  const rr = r["regulations"] ?? [];
  if (!Array.isArray(rr)) errors.push("regulations must be an array");
  else for (const x of rr) {
    if (typeof x === "string" && (REGULATIONS as readonly string[]).includes(x)) { if (!regs.includes(x as Regulation)) regs.push(x as Regulation); }
    else errors.push(`unknown regulation ${JSON.stringify(String(x)).slice(0, 30)}`);
  }
  const controls = {} as Record<ControlId, Level>;
  const cr = r["controls"];
  if (typeof cr !== "object" || cr === null || Array.isArray(cr)) errors.push("controls must be an object");
  else {
    for (const id of CONTROL_IDS) {
      const v = (cr as Record<string, unknown>)[id];
      if (v === undefined) controls[id] = 0;
      else if (v === 0 || v === 1 || v === 2 || v === 3) controls[id] = v;
      else errors.push(`controls.${id} must be 0, 1, 2 or 3`);
    }
    for (const k of Object.keys(cr)) if (!(CONTROL_IDS as readonly string[]).includes(k)) errors.push(`unknown control ${JSON.stringify(k).slice(0, 30)}`);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { name, industry: industry as Industry, employees, revenueEur, regulations: regs, cloudShare, incidents3y, budgetEur, lang, controls } };
}
