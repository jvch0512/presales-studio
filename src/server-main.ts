import { createServer } from "./server.js";

const host = "127.0.0.1";
const port = Number(process.env["PORT"] ?? 8400);
const apiKey = process.env["ANTHROPIC_API_KEY"];
createServer({ ai: apiKey ? { apiKey } : {} }).listen(port, host, () => {
  console.log(`Pre-Sales Studio on http://${host}:${port}  (Claude summary: ${apiKey ? "on" : "off, template"})`);
});
