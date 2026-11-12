import http from "node:http";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTROLS } from "./catalog.js";
import { INDUSTRIES, REGULATIONS, validateInput } from "./model.js";
import { plan } from "./planner.js";
import { renderHtml } from "./render.js";
import { askSummary, buildFacts, AiOptions } from "./summary.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
// The generated proposal has inline CSS but no script can run in it.
export const PROPOSAL_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const MAX_BODY = 64 * 1024;
const MAX_STORED = 50;

const base = (csp: string, extra: Record<string, string> = {}) => ({ "content-security-policy": csp, "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "no-store", ...extra });

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, base(CSP, { "content-type": "application/json; charset=utf-8" }));
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let n = 0;
    req.on("data", (c: Buffer) => { n += c.length; if (n > MAX_BODY) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export function createServer(opts: { ai: AiOptions; publicDir?: string; samplesDir?: string }): http.Server {
  const publicDir = opts.publicDir ?? path.join(ROOT, "public");
  const samplesDir = opts.samplesDir ?? path.join(ROOT, "samples");
  const store = new Map<string, string>();
  const samples = (): string[] => { try { return readdirSync(samplesDir).filter((f) => f.endsWith(".json")).sort(); } catch { return []; } };

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (req.method === "GET" && url.pathname === "/api/schema") {
        return json(res, 200, {
          industries: INDUSTRIES, regulations: REGULATIONS, samples: samples(), aiConfigured: !!opts.ai.apiKey,
          controls: CONTROLS.map((c) => ({ id: c.id, domain: c.domain, name: c.name, why: c.why })),
        });
      }
      const sm = /^\/api\/samples\/([\w.-]+\.json)$/.exec(url.pathname);
      if (req.method === "GET" && sm) {
        if (!samples().includes(sm[1]!)) return json(res, 404, { error: "unknown sample" });
        res.writeHead(200, base(CSP, { "content-type": "application/json; charset=utf-8" }));
        return void res.end(readFileSync(path.join(samplesDir, sm[1]!)));
      }
      if (req.method === "POST" && url.pathname === "/api/proposal") {
        let raw: unknown;
        try { raw = JSON.parse((await readBody(req)).toString("utf8")); } catch (e) {
          return json(res, e instanceof Error && e.message === "too large" ? 413 : 400, { error: e instanceof Error && e.message === "too large" ? "body too large" : "invalid JSON" });
        }
        const v = validateInput(raw);
        if (!v.ok) return json(res, 422, { errors: v.errors });
        const p = plan(v.value);
        const useAi = url.searchParams.get("ai") !== "0";
        const summary = await askSummary(buildFacts(v.value, p), useAi ? opts.ai : {});
        const html = renderHtml(v.value, p, summary.text, summary.source);
        const id = randomUUID();
        store.set(id, html);
        if (store.size > MAX_STORED) store.delete(store.keys().next().value as string);
        return json(res, 200, { id, summary, plan: { before: p.before, after: p.after, totals: p.totals, initiatives: p.initiatives.map((i) => ({ id: i.id, driver: i.driver, annual: i.cost.annual, reduction: i.aleReduction, phase: i.phase })), deferred: p.deferred } });
      }
      const pm = /^\/p\/([0-9a-f-]{36})$/.exec(url.pathname);
      if (req.method === "GET" && pm) {
        const html = store.get(pm[1]!);
        if (!html) return json(res, 404, { error: "proposal expired" });
        res.writeHead(200, base(PROPOSAL_CSP, { "content-type": "text/html; charset=utf-8" }));
        return void res.end(html);
      }
      if (req.method === "GET") {
        const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
        if (!/^[\w.-]+$/.test(name) || !TYPES[path.extname(name)]) return json(res, 404, { error: "not found" });
        try {
          const data = readFileSync(path.join(publicDir, name));
          res.writeHead(200, base(CSP, { "content-type": TYPES[path.extname(name)]! }));
          return void res.end(data);
        } catch { return json(res, 404, { error: "not found" }); }
      }
      json(res, 405, { error: "method not allowed" });
    } catch {
      json(res, 500, { error: "internal error" });
    }
  });
}
