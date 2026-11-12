// DOM built with createElement/textContent only. The proposal itself is rendered by the server and shown in an iframe
// served with a CSP that forbids scripts.
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); };
const LEVELS = ["None", "Partial", "Solid", "Mature"];
let schema;

async function init() {
  schema = await (await fetch("/api/schema")).json();
  const ai = $("ai"); ai.textContent = schema.aiConfigured ? "AI: Claude" : "AI: template"; if (schema.aiConfigured) ai.classList.add("on");
  for (const i of schema.industries) { const o = el("option", "", i); o.value = i; $("industry").append(o); }
  for (const r of schema.regulations) { const l = el("label"); const c = document.createElement("input"); c.type = "checkbox"; c.value = r; l.append(c, document.createTextNode(r)); $("regs").append(l); }
  for (const c of schema.controls) {
    const row = el("div", "ctl"); row.append(el("span", "", c.name.en));
    const s = document.createElement("select"); s.dataset.control = c.id;
    LEVELS.forEach((n, i) => { const o = el("option", "", n); o.value = String(i); s.append(o); });
    row.append(s); $("controls").append(row);
  }
  for (const name of schema.samples) {
    const b = el("button", "s", name.replace(/\.json$/, "")); b.type = "button";
    b.addEventListener("click", async () => fill(await (await fetch("/api/samples/" + name)).json()));
    $("samples").append(b);
  }
}

function fill(d) {
  $("name").value = d.name; $("industry").value = d.industry; $("lang").value = d.lang || "en";
  $("employees").value = d.employees; $("revenueEur").value = d.revenueEur; $("cloud").value = Math.round(d.cloudShare * 100);
  $("incidents3y").value = d.incidents3y; $("budgetEur").value = d.budgetEur;
  for (const c of $("regs").querySelectorAll("input")) c.checked = d.regulations.includes(c.value);
  for (const s of $("controls").querySelectorAll("select")) s.value = String(d.controls[s.dataset.control] ?? 0);
}

function collect() {
  const controls = {};
  for (const s of $("controls").querySelectorAll("select")) controls[s.dataset.control] = Number(s.value);
  return {
    name: $("name").value, industry: $("industry").value, lang: $("lang").value,
    employees: Number($("employees").value), revenueEur: Number($("revenueEur").value), cloudShare: Number($("cloud").value) / 100,
    incidents3y: Number($("incidents3y").value), budgetEur: Number($("budgetEur").value),
    regulations: [...$("regs").querySelectorAll("input")].filter((c) => c.checked).map((c) => c.value), controls,
  };
}

const eur = (n) => (Math.abs(n) >= 1e6 ? "€" + (n / 1e6).toFixed(1) + "M" : "€" + Math.round(n / 1000) + "k");
const pct = (x) => Math.round(x * 100) + "%";

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("error"); err.hidden = true;
  try {
    const res = await fetch("/api/proposal" + ($("useai").checked ? "" : "?ai=0"), { method: "POST", body: JSON.stringify(collect()) });
    const d = await res.json();
    if (!res.ok) throw new Error((d.errors || [d.error]).join("; "));
    const k = $("kpis"); clear(k);
    const add = (big, small) => { const c = el("div", "kpi"); c.append(el("b", "", big), el("span", "", small)); k.append(c); };
    add(`${pct(d.plan.before.maturity)} → ${pct(d.plan.after.maturity)}`, "NIST CSF maturity");
    add(`${eur(d.plan.before.ale)} → ${eur(d.plan.after.ale)}`, "Expected annual loss");
    add(eur(d.plan.totals.annualCost), "Annual investment");
    add(pct(d.plan.totals.roi), d.plan.totals.paybackMonths === null ? "ROI" : `ROI, payback ${Math.round(d.plan.totals.paybackMonths)} months`);
    $("note").textContent = `Summary by ${d.summary.source}${d.summary.note ? ": " + d.summary.note : ""}`;
    $("frame").src = "/p/" + d.id; $("open").href = "/p/" + d.id; $("out").hidden = false;
  } catch (x) { err.hidden = false; err.textContent = "Could not generate: " + x.message; }
});

init().then(() => fetch("/api/samples/northwind-retail.json")).then((r) => r.json()).then(fill);
