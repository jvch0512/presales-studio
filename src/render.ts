import { CONTROLS, CONTROL_BY_ID, DOMAINS, ASSUMPTIONS as A, Control } from "./catalog.js";
import type { ClientInput, Lang } from "./model.js";
import type { Plan } from "./planner.js";
import { eur, pct } from "./summary.js";
import { singleLoss } from "./risk.js";

export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const T = {
  en: {
    title: "Cybersecurity proposal", prepared: "Prepared for", exec: "Executive summary", posture: "Current posture (NIST CSF)", before: "Today", after: "After the programme",
    maturity: "Maturity", ale: "Expected annual loss", cost: "Annual investment", roi: "Return on investment", payback: "Payback", months: "months",
    recs: "Recommended initiatives", name: "Initiative", why: "Why it matters", firstYear: "Year 1", annual: "Annual", reduction: "Loss reduced", driver: "Basis", roiB: "ROI", compB: "Compliance", rm: "Roadmap (weeks)", arch: "Target architecture",
    existing: "In place", upgraded: "Proposed", gap: "Not funded", compl: "Compliance coverage", framework: "Framework", mapped: "mapped controls", deferred: "Not recommended now",
    dReason: { budget: "outside the annual budget", roi: "cost exceeds the risk it removes and no framework requires it", "no-benefit": "no additional benefit in the model" },
    assumptions: "Assumptions and limits", disclaimer: "Figures are model estimates from the questionnaire, not audited findings. Prices are indicative and should be replaced with your price list. Framework mappings are indicative and must be checked against the current text before an audit.",
    funcs: { identify: "Identify", protect: "Protect", detect: "Detect", respond: "Respond", recover: "Recover" },
    layers: { identity: "Identity and people", endpoint: "Endpoints", network: "Network and applications", detection: "Detection and response", recovery: "Recovery", governance: "Governance and testing" },
    probability: "Annual incident probability", single: "Single loss event", budget: "Budget", total: "Total", net: "Net benefit", oneOff: "One-off",
    a1: "Annual incident probability = industry base rate x (1.4 - 0.9 x maturity) x incident history x cloud exposure, capped at 85%.",
    a2: "Single loss event = 2.5% of revenue, between 150k and 12M euro, plus 15% when the client is regulated.",
    a3: "Initiative cost = recurring + per-user fees + one-off cost amortized over 3 years. Partly built controls cost less.",
    a4: "Initiatives are picked by marginal ROI inside the budget, re-evaluating the loss model after each pick. Controls required by a framework are kept even when their ROI is below 1.",
  },
  es: {
    title: "Propuesta de ciberseguridad", prepared: "Preparada para", exec: "Resumen ejecutivo", posture: "Situación actual (NIST CSF)", before: "Hoy", after: "Tras el programa",
    maturity: "Madurez", ale: "Pérdida anual esperada", cost: "Inversión anual", roi: "Retorno de la inversión", payback: "Recuperación", months: "meses",
    recs: "Iniciativas recomendadas", name: "Iniciativa", why: "Por qué importa", firstYear: "Año 1", annual: "Anual", reduction: "Pérdida reducida", driver: "Motivo", roiB: "ROI", compB: "Normativa", rm: "Hoja de ruta (semanas)", arch: "Arquitectura objetivo",
    existing: "Existente", upgraded: "Propuesto", gap: "Sin financiar", compl: "Cobertura normativa", framework: "Marco", mapped: "controles asociados", deferred: "No recomendado ahora",
    dReason: { budget: "fuera del presupuesto anual", roi: "el coste supera el riesgo que elimina y ningún marco lo exige", "no-benefit": "sin beneficio adicional en el modelo" },
    assumptions: "Hipótesis y límites", disclaimer: "Las cifras son estimaciones del modelo a partir del cuestionario, no hallazgos de auditoría. Los precios son orientativos y deben sustituirse por su tarifa. Las correspondencias con marcos normativos son orientativas y deben verificarse con el texto vigente antes de una auditoría.",
    funcs: { identify: "Identificar", protect: "Proteger", detect: "Detectar", respond: "Responder", recover: "Recuperar" },
    layers: { identity: "Identidad y personas", endpoint: "Endpoints", network: "Red y aplicaciones", detection: "Detección y respuesta", recovery: "Recuperación", governance: "Gobierno y pruebas" },
    probability: "Probabilidad anual de incidente", single: "Pérdida por evento", budget: "Presupuesto", total: "Total", net: "Beneficio neto", oneOff: "Inicial",
    a1: "Probabilidad anual = tasa base del sector x (1,4 - 0,9 x madurez) x historial de incidentes x exposición cloud, con tope del 85%.",
    a2: "Pérdida por evento = 2,5% de la facturación, entre 150 mil y 12 millones de euros, más un 15% si el cliente está regulado.",
    a3: "Coste de iniciativa = recurrente + tarifas por usuario + coste inicial amortizado en 3 años. Los controles a medio construir cuestan menos.",
    a4: "Las iniciativas se eligen por ROI marginal dentro del presupuesto, recalculando el modelo tras cada elección. Los controles exigidos por un marco se mantienen aunque su ROI sea inferior a 1.",
  },
} as const;

const fmt = (n: number) => `€${Math.round(n).toLocaleString("en-US")}`;

function radar(p: Plan, lang: Lang): string {
  const cx = 150, cy = 140, R = 100;
  const pt = (i: number, v: number) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; return `${(cx + R * v * Math.cos(a)).toFixed(1)},${(cy + R * v * Math.sin(a)).toFixed(1)}`; };
  const rings = [0.25, 0.5, 0.75, 1].map((r) => `<polygon points="${DOMAINS.map((_, i) => pt(i, r)).join(" ")}" fill="none" stroke="#d5dbe8"/>`).join("");
  const labels = DOMAINS.map((d, i) => { const [x, y] = pt(i, 1.2).split(",") as [string, string]; return `<text x="${x}" y="${y}" text-anchor="middle" font-size="11" fill="#445">${esc(T[lang].funcs[d])}</text>`; }).join("");
  const poly = (m: Record<string, number>, fill: string, stroke: string) => `<polygon points="${DOMAINS.map((d, i) => pt(i, m[d] ?? 0)).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
  return `<svg viewBox="0 0 300 280" width="300" role="img" aria-label="${esc(T[lang].posture)}">${rings}${labels}${poly(p.before.domains, "rgba(220,70,80,.25)", "#dc4650")}${poly(p.after.domains, "rgba(40,130,90,.25)", "#28825a")}</svg>`;
}

function gantt(p: Plan, lang: Lang): string {
  const rowH = 22, left = 320, w = 560, end = Math.max(52, ...p.initiatives.map((i) => i.startWeek + i.weeks));
  const x = (wk: number) => left + (wk / end) * w;
  const rows = p.initiatives.map((i, k) => {
    const c = CONTROL_BY_ID[i.id];
    const y = 30 + k * rowH;
    return `<text x="8" y="${y + 13}" font-size="11" fill="#223">${esc(c.name[lang])}</text><rect x="${x(i.startWeek).toFixed(1)}" y="${y}" width="${Math.max(4, (i.weeks / end) * w).toFixed(1)}" height="16" rx="3" fill="${i.phase === 1 ? "#1f6feb" : i.phase === 2 ? "#6f42c1" : "#8a94a6"}"/>`;
  }).join("");
  const ticks = [0, 13, 26, 39, 52].filter((t) => t <= end).map((t) => `<line x1="${x(t)}" y1="22" x2="${x(t)}" y2="${30 + p.initiatives.length * rowH}" stroke="#e1e6f0"/><text x="${x(t)}" y="16" font-size="10" text-anchor="middle" fill="#667">${t}</text>`).join("");
  return `<svg viewBox="0 0 ${left + w + 20} ${40 + p.initiatives.length * rowH}" width="100%" role="img" aria-label="${esc(T[lang].rm)}">${ticks}${rows}</svg>`;
}

function boxLabel(name: string, cx: number, y: number): string {
  if (name.length <= 24) return `<text x="${cx}" y="${y + 23}" font-size="10.5" text-anchor="middle" fill="#223">${esc(name)}</text>`;
  const words = name.split(" ");
  let best = 1, diff = Infinity;
  for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length); if (d < diff) { diff = d; best = i; } }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")].map((l, k) => `<text x="${cx}" y="${y + 16 + k * 12}" font-size="10" text-anchor="middle" fill="#223">${esc(l)}</text>`).join("");
}

function architecture(c: ClientInput, p: Plan, lang: Lang): string {
  const layers = ["identity", "endpoint", "network", "detection", "recovery", "governance"] as const;
  const chosen = new Set(p.initiatives.map((i) => i.id));
  let y = 10;
  const out: string[] = [];
  for (const layer of layers) {
    const ctls: Control[] = CONTROLS.filter((x) => x.layer === layer);
    out.push(`<text x="8" y="${y + 26}" font-size="12" font-weight="700" fill="#223">${esc(T[lang].layers[layer])}</text>`);
    ctls.forEach((k, i) => {
      const x = 190 + i * 175;
      const state = chosen.has(k.id) ? "up" : c.controls[k.id] >= 2 ? "ok" : "gap";
      const style = state === "up" ? 'fill="#e4efff" stroke="#1f6feb" stroke-width="2"' : state === "ok" ? 'fill="#eef1f6" stroke="#9aa5b8"' : 'fill="#fff" stroke="#dc4650" stroke-dasharray="5 3"';
      out.push(`<rect x="${x}" y="${y}" width="165" height="38" rx="6" ${style}/>${boxLabel(k.name[lang].replace(/ \(.*\)/, ""), x + 82, y)}`);
    });
    y += 48;
  }
  const legend = [["#1f6feb", T[lang].upgraded], ["#9aa5b8", T[lang].existing], ["#dc4650", T[lang].gap]].map(([col, label], i) => `<rect x="${190 + i * 170}" y="${y + 6}" width="12" height="12" fill="none" stroke="${col}" stroke-width="2"/><text x="${208 + i * 170}" y="${y + 16}" font-size="11" fill="#445">${esc(label!)}</text>`).join("");
  return `<svg viewBox="0 0 1250 ${y + 30}" width="100%" role="img" aria-label="${esc(T[lang].arch)}">${out.join("")}${legend}</svg>`;
}

const CSS = `body{font:14px/1.55 system-ui,Segoe UI,sans-serif;color:#1c2233;margin:0;background:#eef1f6}
.page{max-width:980px;margin:24px auto;background:#fff;padding:44px 52px;box-shadow:0 2px 24px rgba(20,30,60,.12)}
.cover{border-bottom:4px solid #1f6feb;padding-bottom:22px;margin-bottom:26px}.cover small{color:#667;text-transform:uppercase;letter-spacing:.12em}
h1{font-size:30px;margin:6px 0}h2{font-size:18px;margin:30px 0 10px;border-left:4px solid #1f6feb;padding-left:10px}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.kpi{background:#f4f7fc;border-radius:10px;padding:12px 14px}.kpi b{display:block;font-size:22px}.kpi span{color:#667;font-size:12px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:7px 8px;border-bottom:1px solid #e3e8f2;text-align:left;vertical-align:top}th{background:#f4f7fc;font-size:12px}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.tag{display:inline-block;padding:1px 8px;border-radius:99px;font-size:11px;background:#e4efff;color:#1f55b0}.tag.c{background:#f3e8ff;color:#6f42c1}
.two{display:grid;grid-template-columns:320px 1fr;gap:24px;align-items:center}.bw{width:38%}.bar{height:10px;background:#e3e8f2;border-radius:5px;overflow:hidden}.bar i{display:block;height:100%;background:#1f6feb}
.muted{color:#667;font-size:12px}.src{font-size:11px;color:#8a94a6}
@media print{body{background:#fff}.page{box-shadow:none;margin:0;padding:18px}h2{break-after:avoid}table,svg{break-inside:avoid}}`;

export function renderHtml(c: ClientInput, p: Plan, summary: string, source: "claude" | "template"): string {
  const L = c.lang;
  const t = T[L];
  const rows = p.initiatives.map((i) => {
    const k = CONTROL_BY_ID[i.id];
    return `<tr><td><b>${esc(k.name[L])}</b><div class="muted">${esc(k.why[L])}</div></td><td class="n">${fmt(i.cost.firstYear)}</td><td class="n">${fmt(i.cost.annual)}</td><td class="n">${fmt(i.aleReduction)}</td><td><span class="tag ${i.driver === "compliance" ? "c" : ""}">${i.driver === "compliance" ? t.compB : t.roiB}</span></td></tr>`;
  }).join("");
  const cov = (a: Plan["before"]["coverage"], b: Plan["after"]["coverage"]) => a.map((x, k) => {
    const after = b[k]!;
    return `<tr><td>${esc(x.framework)}</td><td class="n">${x.mapped} ${esc(t.mapped)}</td><td class="n">${pct(x.pct)}</td><td class="bw"><div class="bar"><i style="width:${Math.round(after.pct * 100)}%"></i></div></td><td class="n">${pct(after.pct)}</td></tr>`;
  }).join("");
  const deferred = p.deferred.length ? `<h2>${esc(t.deferred)}</h2><ul>${p.deferred.map((d) => `<li>${esc(CONTROL_BY_ID[d.id].name[L])}: ${esc(t.dReason[d.reason])}</li>`).join("")}</ul>` : "";
  const covHtml = p.before.coverage.length ? `<h2>${esc(t.compl)}</h2><table><tr><th>${esc(t.framework)}</th><th class="n"></th><th class="n">${esc(t.before)}</th><th></th><th class="n">${esc(t.after)}</th></tr>${cov(p.before.coverage, p.after.coverage)}</table><p class="src">${esc(t.disclaimer)}</p>` : "";
  return `<!doctype html><html lang="${L}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(t.title)} - ${esc(c.name)}</title><style>${CSS}</style></head><body><div class="page">
<div class="cover"><small>${esc(t.title)}</small><h1>${esc(c.name)}</h1><div class="muted">${esc(t.prepared)} ${esc(c.name)} · ${esc(c.industry)} · ${c.employees.toLocaleString("en-US")} FTE · ${esc(c.regulations.join(", ") || "-")}</div></div>
<h2>${esc(t.exec)}</h2><p>${esc(summary)}</p><p class="src">${source === "claude" ? "Text polished by Claude. Every figure was verified against the computed model." : ""}</p>
<div class="kpis"><div class="kpi"><b>${pct(p.before.maturity)} → ${pct(p.after.maturity)}</b><span>${esc(t.maturity)}</span></div><div class="kpi"><b>${eur(p.before.ale)} → ${eur(p.after.ale)}</b><span>${esc(t.ale)}</span></div><div class="kpi"><b>${eur(p.totals.annualCost)}</b><span>${esc(t.cost)} (${esc(t.budget)} ${eur(c.budgetEur)})</span></div><div class="kpi"><b>${pct(p.totals.roi)}</b><span>${esc(t.roi)} · ${p.totals.paybackMonths === null ? "n/a" : Math.round(p.totals.paybackMonths) + " " + esc(t.months)}</span></div></div>
<h2>${esc(t.posture)}</h2><div class="two">${radar(p, L)}<div><p><span style="color:#dc4650">■</span> ${esc(t.before)} · <span style="color:#28825a">■</span> ${esc(t.after)}</p><table>${DOMAINS.map((d) => `<tr><td>${esc(t.funcs[d])}</td><td class="n">${pct(p.before.domains[d])}</td><td class="n">${pct(p.after.domains[d])}</td></tr>`).join("")}</table></div></div>
<h2>${esc(t.recs)}</h2><table><tr><th>${esc(t.name)}</th><th class="n">${esc(t.firstYear)}</th><th class="n">${esc(t.annual)}</th><th class="n">${esc(t.reduction)}</th><th>${esc(t.driver)}</th></tr>${rows}<tr><td><b>${esc(t.total)}</b></td><td class="n"><b>${fmt(p.totals.firstYear)}</b></td><td class="n"><b>${fmt(p.totals.annualCost)}</b></td><td class="n"><b>${fmt(p.totals.aleReduction)}</b></td><td></td></tr></table>
${deferred}
<h2>${esc(t.rm)}</h2>${gantt(p, L)}
<h2>${esc(t.arch)}</h2>${architecture(c, p, L)}
${covHtml}
<h2>${esc(t.assumptions)}</h2><ul class="muted"><li>${esc(t.a1)}</li><li>${esc(t.a2)} ${esc(t.single)}: ${fmt(singleLoss(c))}.</li><li>${esc(t.a3)}</li><li>${esc(t.a4)}</li></ul><p class="src">${esc(t.disclaimer)}</p>
</div></body></html>`;
}

export function renderMarkdown(c: ClientInput, p: Plan, summary: string): string {
  const L = c.lang;
  const t = T[L];
  const lines = [`# ${t.title}: ${c.name}`, "", summary, "", `| ${t.maturity} | ${t.ale} | ${t.cost} | ${t.roi} |`, "|---|---|---|---|", `| ${pct(p.before.maturity)} → ${pct(p.after.maturity)} | ${eur(p.before.ale)} → ${eur(p.after.ale)} | ${eur(p.totals.annualCost)} | ${pct(p.totals.roi)} |`, "", `## ${t.recs}`, "", `| ${t.name} | ${t.firstYear} | ${t.annual} | ${t.reduction} | ${t.driver} |`, "|---|---:|---:|---:|---|"];
  for (const i of p.initiatives) lines.push(`| ${CONTROL_BY_ID[i.id].name[L].replace(/\|/g, "/")} | ${fmt(i.cost.firstYear)} | ${fmt(i.cost.annual)} | ${fmt(i.aleReduction)} | ${i.driver === "compliance" ? t.compB : t.roiB} |`);
  lines.push(`| **${t.total}** | **${fmt(p.totals.firstYear)}** | **${fmt(p.totals.annualCost)}** | **${fmt(p.totals.aleReduction)}** | |`);
  lines.push("", `_${t.disclaimer}_`, "");
  return lines.join("\n");
}
export { A as assumptions };
