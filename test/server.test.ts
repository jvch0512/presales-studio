import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { createServer, CSP, PROPOSAL_CSP } from "../src/server.js";

async function withServer<T>(fn: (b: string) => Promise<T>): Promise<T> {
  const s = createServer({ ai: {} });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  try { return await fn(`http://127.0.0.1:${(s.address() as AddressInfo).port}`); } finally { await new Promise((r) => s.close(r)); }
}
const sample = () => readFileSync(new URL("../../samples/northwind-retail.json", import.meta.url), "utf8");

test("schema exposes controls and industries", () => withServer(async (b) => {
  const j: any = await (await fetch(b + "/api/schema")).json();
  assert.equal(j.controls.length, 15);
  assert.ok(j.industries.includes("retail"));
  assert.equal(j.aiConfigured, false);
  assert.ok(j.samples.includes("northwind-retail.json"));
}));

test("proposal endpoint returns the plan and a retrievable HTML document", () => withServer(async (b) => {
  const res = await fetch(b + "/api/proposal", { method: "POST", body: sample() });
  assert.equal(res.status, 200);
  const j: any = await res.json();
  assert.equal(j.summary.source, "template");
  assert.ok(j.plan.totals.annualCost > 0);
  const page = await fetch(b + "/p/" + j.id);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("content-security-policy"), PROPOSAL_CSP);
  assert.match(await page.text(), /Northwind Retail Group/);
}));

test("validation errors are 422 and malformed JSON is 400", () => withServer(async (b) => {
  const r = await fetch(b + "/api/proposal", { method: "POST", body: JSON.stringify({ name: "x" }) });
  assert.equal(r.status, 422);
  assert.ok(((await r.json()) as any).errors.length > 3);
  assert.equal((await fetch(b + "/api/proposal", { method: "POST", body: "{nope" })).status, 400);
}));

test("oversized bodies are refused", () => withServer(async (b) => {
  try {
    const r = await fetch(b + "/api/proposal", { method: "POST", body: "x".repeat(200_000) });
    assert.equal(r.status, 413);
  } catch (e) { assert.ok(e instanceof TypeError); }
}));

test("proposal ids must be valid and unknown ones are 404", () => withServer(async (b) => {
  assert.equal((await fetch(b + "/p/not-an-id")).status, 404);
  assert.equal((await fetch(b + "/p/00000000-0000-0000-0000-000000000000")).status, 404);
}));

test("the app shell has a strict CSP, the proposal CSP allows no scripts", () => withServer(async (b) => {
  for (const p of ["/", "/app.js", "/style.css", "/api/schema"]) assert.equal((await fetch(b + p)).headers.get("content-security-policy"), CSP);
  assert.ok(!CSP.includes("unsafe-inline"));
  assert.ok(!/script-src/.test(PROPOSAL_CSP));
  assert.match(PROPOSAL_CSP, /default-src 'none'/);
}));

test("static files: traversal and unknown types are refused", () => withServer(async (b) => {
  assert.equal((await fetch(b + "/..%2Fpackage.json")).status, 404);
  assert.equal((await fetch(b + "/package.json")).status, 404);
  assert.equal((await fetch(b + "/api/samples/secret.json")).status, 404);
  assert.equal((await fetch(b + "/api/proposal", { method: "PUT" })).status, 405);
}));

test("the store is bounded", () => withServer(async (b) => {
  const ids: string[] = [];
  for (let i = 0; i < 53; i++) ids.push(((await (await fetch(b + "/api/proposal?ai=0", { method: "POST", body: sample() })).json()) as any).id);
  assert.equal((await fetch(b + "/p/" + ids[0])).status, 404);
  assert.equal((await fetch(b + "/p/" + ids[52])).status, 200);
}));

test("UI source never uses innerHTML or inline handlers", () => {
  const js = readFileSync(new URL("../../public/app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../../public/index.html", import.meta.url), "utf8");
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(js));
  assert.ok(!/<script(?![^>]*\bsrc=)|\son\w+=|style=/i.test(html));
});
