#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { validateInput } from "./model.js";
import { plan } from "./planner.js";
import { renderHtml, renderMarkdown } from "./render.js";
import { askSummary, buildFacts } from "./summary.js";

const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const input = args.find((a) => !a.startsWith("--") && a !== flag("--out") && a !== flag("--format"));
if (!input) {
  console.error("usage: presales-studio <client.json> [--format html|md|json] [--out file] [--no-ai]");
  process.exit(2);
}
const v = validateInput(JSON.parse(readFileSync(input, "utf8")));
if (!v.ok) {
  console.error("invalid input:\n  " + v.errors.join("\n  "));
  process.exit(2);
}
const p = plan(v.value);
const apiKey = process.env["ANTHROPIC_API_KEY"];
const s = await askSummary(buildFacts(v.value, p), args.includes("--no-ai") || !apiKey ? {} : { apiKey });
const fmt = flag("--format") ?? "html";
const out = fmt === "md" ? renderMarkdown(v.value, p, s.text) : fmt === "json" ? JSON.stringify({ summary: s, plan: p }, null, 2) : renderHtml(v.value, p, s.text, s.source);
const dest = flag("--out");
if (dest) writeFileSync(dest, out);
else process.stdout.write(out);
