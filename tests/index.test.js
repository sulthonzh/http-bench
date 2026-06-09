const test = require("node:test");
const assert = require("node:assert/strict");
const { runBench, singleRequest, formatText, formatJSON, formatMarkdown, parseArgs, HELP } = require("../src/index");

// --- parseArgs ---
test("parseArgs: defaults", () => {
  const { url, opts } = parseArgs(["node", "hb", "https://example.com"]);
  assert.equal(url, "https://example.com");
  assert.equal(opts.requests, 10);
  assert.equal(opts.concurrency, 1);
  assert.equal(opts.method, "GET");
  assert.equal(opts.timeout, 10000);
  assert.equal(opts.format, "text");
});

test("parseArgs: custom options", () => {
  const { url, opts } = parseArgs(["node", "hb", "http://localhost:3000", "-n", "50", "-c", "5", "-m", "POST", "-t", "5000", "-f", "json"]);
  assert.equal(url, "http://localhost:3000");
  assert.equal(opts.requests, 50);
  assert.equal(opts.concurrency, 5);
  assert.equal(opts.method, "POST");
  assert.equal(opts.timeout, 5000);
  assert.equal(opts.format, "json");
});

test("parseArgs: --help", () => {
  const { opts } = parseArgs(["node", "hb", "--help"]);
  assert.equal(opts.help, true);
});

test("parseArgs: no URL", () => {
  const { url } = parseArgs(["node", "hb"]);
  assert.equal(url, null);
});

// --- HELP ---
test("HELP: contains usage info", () => {
  assert.ok(HELP.includes("http-bench"));
  assert.ok(HELP.includes("Usage"));
  assert.ok(HELP.includes("-n"));
});

// --- formatText ---
test("formatText: shows stats", () => {
  const stats = {
    min: 10, max: 50, mean: 25, median: 24, p50: 24, p90: 45, p95: 47, p99: 49,
    totalTime: 250, requestsPerSec: 40, avgBytes: 1024,
    statusCounts: { 200: 10 }, successCount: 10, errorCount: 0, errors: []
  };
  const out = formatText("https://example.com", { requests: 10, concurrency: 1, method: "GET" }, { stats });
  assert.ok(out.includes("Benchmark: https://example.com"));
  assert.ok(out.includes("10.00 ms"));
  assert.ok(out.includes("40.00 req/s"));
  assert.ok(out.includes("200: 10"));
});

test("formatText: shows errors when all fail", () => {
  const stats = { successCount: 0, errorCount: 3, errors: ["ECONNREFUSED", "timeout", "ECONNREFUSED"] };
  const out = formatText("http://localhost", {}, { stats });
  assert.ok(out.includes("All requests failed"));
  assert.ok(out.includes("ECONNREFUSED"));
});

// --- formatJSON ---
test("formatJSON: valid JSON output", () => {
  const stats = { min: 10, max: 20, mean: 15, successCount: 5, errorCount: 0, errors: [] };
  const out = formatJSON("https://x.com", { requests: 5 }, { stats });
  const parsed = JSON.parse(out);
  assert.equal(parsed.url, "https://x.com");
  assert.equal(parsed.stats.min, 10);
});

// --- formatMarkdown ---
test("formatMarkdown: has table", () => {
  const stats = {
    min: 5, max: 30, mean: 15, median: 14, p90: 25, p95: 28, p99: 29,
    totalTime: 150, requestsPerSec: 33, successCount: 10, errorCount: 0, errors: []
  };
  const out = formatMarkdown("https://example.com", { requests: 10 }, { stats });
  assert.ok(out.includes("# http-bench"));
  assert.ok(out.includes("| Metric |"));
  assert.ok(out.includes("5.00 ms"));
});

test("formatMarkdown: all failed", () => {
  const stats = { successCount: 0, errorCount: 2, errors: ["fail"] };
  const out = formatMarkdown("https://x.com", {}, { stats });
  assert.ok(out.includes("All requests failed"));
});

// --- singleRequest (real HTTP call) ---
test("singleRequest: hits a real endpoint", async () => {
  // Use httpbin or a reliable public endpoint
  const result = await singleRequest("https://httpbin.org/get", { timeout: 15000 });
  assert.equal(result.status, 200);
  assert.ok(result.duration > 0);
  assert.ok(result.bytes > 0);
  assert.ok(!result.error);
});

// --- runBench (real) ---
test("runBench: runs multiple requests", async () => {
  const { results, stats } = await runBench("https://httpbin.org/get", { requests: 3, concurrency: 1, timeout: 15000 });
  assert.equal(results.length, 3);
  assert.ok(stats.successCount >= 1); // at least 1 should succeed
  assert.ok(stats.min > 0);
  assert.ok(stats.mean >= stats.min);
  assert.ok(stats.max >= stats.mean);
});
