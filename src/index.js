const http = require("http");
const https = require("https");

/**
 * Run a single HTTP request and measure timing.
 * @param {string} url
 * @param {object} [opts]
 * @returns {Promise<{status:number, bytes:number, duration:number, error?:string}>}
 */
function singleRequest(url, opts = {}) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const mod = url.startsWith("https") ? https : http;
    const req = mod.request(url, { method: opts.method || "GET" }, (res) => {
      let bytes = 0;
      res.on("data", (chunk) => { bytes += chunk.length; });
      res.on("end", () => {
        const duration = Number(process.hrtime.bigint() - start) / 1e6; // ms
        resolve({ status: res.statusCode, bytes, duration });
      });
    });
    req.on("error", (err) => {
      const duration = Number(process.hrtime.bigint() - start) / 1e6;
      resolve({ status: 0, bytes: 0, duration, error: err.message });
    });
    req.setTimeout(opts.timeout || 10000, () => {
      req.destroy(new Error("timeout"));
    });
    req.end();
  });
}

/**
 * Run N requests against a URL and collect stats.
 * @param {string} url
 * @param {object} [opts] - requests (default 10), concurrency (default 1), method, timeout
 * @param {function} [onProgress] - called with (completed, total)
 * @returns {Promise<{results:Array, stats:object}>}
 */
async function runBench(url, opts = {}, onProgress) {
  const total = opts.requests || 10;
  const concurrency = opts.concurrency || 1;
  const results = [];
  let completed = 0;

  for (let i = 0; i < total; i += concurrency) {
    const batch = [];
    for (let j = i; j < Math.min(i + concurrency, total); j++) {
      batch.push(
        singleRequest(url, opts).then((r) => {
          completed++;
          if (onProgress) onProgress(completed, total);
          return r;
        })
      );
    }
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }

  const durations = results.filter((r) => !r.error).map((r) => r.duration);
  const errors = results.filter((r) => r.error);
  const statuses = results.filter((r) => !r.error).map((r) => r.status);

  const stats = {};
  if (durations.length > 0) {
    durations.sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);
    stats.min = durations[0];
    stats.max = durations[durations.length - 1];
    stats.mean = sum / durations.length;
    stats.median = durations[Math.floor(durations.length / 2)];
    stats.p50 = durations[Math.floor(durations.length * 0.5)];
    stats.p90 = durations[Math.floor(durations.length * 0.9)];
    stats.p95 = durations[Math.floor(durations.length * 0.95)];
    stats.p99 = durations[Math.min(Math.floor(durations.length * 0.99), durations.length - 1)];
    stats.totalTime = sum;
    stats.requestsPerSec = durations.length / (sum / 1000);
    stats.avgBytes = results.filter((r) => !r.error).reduce((a, r) => a + r.bytes, 0) / durations.length;
    const statusCounts = {};
    statuses.forEach((s) => { statusCounts[s] = (statusCounts[s] || 0) + 1; });
    stats.statusCounts = statusCounts;
  }
  stats.successCount = durations.length;
  stats.errorCount = errors.length;
  stats.errors = errors.map((e) => e.error);

  return { results, stats };
}

function formatText(url, opts, { stats }) {
  const lines = [];
  lines.push(`Benchmark: ${url}`);
  lines.push(`  ${opts.requests || 10} requests, concurrency ${opts.concurrency || 1}, method ${opts.method || "GET"}`);
  lines.push("");
  if (stats.successCount === 0) {
    lines.push("  All requests failed.");
    stats.errors.forEach((e) => lines.push(`  - ${e}`));
    return lines.join("\n");
  }
  const fmt = (v) => v.toFixed(2);
  lines.push(`  Latency:`);
  lines.push(`    min:    ${fmt(stats.min)} ms`);
  lines.push(`    mean:   ${fmt(stats.mean)} ms`);
  lines.push(`    median: ${fmt(stats.median)} ms`);
  lines.push(`    max:    ${fmt(stats.max)} ms`);
  lines.push(`  Percentiles:`);
  lines.push(`    p50: ${fmt(stats.p50)} ms`);
  lines.push(`    p90: ${fmt(stats.p90)} ms`);
  lines.push(`    p95: ${fmt(stats.p95)} ms`);
  lines.push(`    p99: ${fmt(stats.p99)} ms`);
  lines.push(`  Throughput: ${fmt(stats.requestsPerSec)} req/s`);
  lines.push(`  Total time: ${fmt(stats.totalTime)} ms`);
  lines.push(`  Avg bytes:  ${Math.round(stats.avgBytes).toLocaleString()}`);
  lines.push(`  Status codes:`);
  Object.entries(stats.statusCounts).forEach(([code, count]) => {
    lines.push(`    ${code}: ${count}`);
  });
  if (stats.errorCount > 0) {
    lines.push(`  Errors: ${stats.errorCount}`);
    stats.errors.slice(0, 5).forEach((e) => lines.push(`    - ${e}`));
  }
  return lines.join("\n");
}

function formatJSON(url, opts, data) {
  return JSON.stringify({ url, options: opts, stats: data.stats }, null, 2);
}

function formatMarkdown(url, opts, { stats }) {
  const lines = [];
  lines.push(`# http-bench: ${url}`);
  lines.push("");
  lines.push(`**${opts.requests || 10} requests** | concurrency ${opts.concurrency || 1} | method ${opts.method || "GET"}`);
  lines.push("");
  if (stats.successCount === 0) {
    lines.push("> All requests failed.");
    return lines.join("\n");
  }
  const fmt = (v) => v.toFixed(2);
  lines.push("| Metric | Value |");
  lines.push("|---|---|");
  lines.push(`| Min | ${fmt(stats.min)} ms |`);
  lines.push(`| Mean | ${fmt(stats.mean)} ms |`);
  lines.push(`| Median | ${fmt(stats.median)} ms |`);
  lines.push(`| Max | ${fmt(stats.max)} ms |`);
  lines.push(`| p90 | ${fmt(stats.p90)} ms |`);
  lines.push(`| p95 | ${fmt(stats.p95)} ms |`);
  lines.push(`| p99 | ${fmt(stats.p99)} ms |`);
  lines.push(`| Throughput | ${fmt(stats.requestsPerSec)} req/s |`);
  lines.push(`| Total time | ${fmt(stats.totalTime)} ms |`);
  lines.push(`| Success | ${stats.successCount} |`);
  if (stats.errorCount > 0) {
    lines.push(`| Errors | ${stats.errorCount} |`);
  }
  return lines.join("\n");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { requests: 10, concurrency: 1, method: "GET", timeout: 10000, format: "text" };
  let url = null;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "-n": case "--requests": opts.requests = parseInt(args[++i], 10); break;
      case "-c": case "--concurrency": opts.concurrency = parseInt(args[++i], 10); break;
      case "-m": case "--method": opts.method = args[++i].toUpperCase(); break;
      case "-t": case "--timeout": opts.timeout = parseInt(args[++i], 10); break;
      case "-f": case "--format": opts.format = args[++i]; break;
      case "-h": case "--help": opts.help = true; break;
      default:
        if (!args[i].startsWith("-")) url = args[i];
        break;
    }
  }

  return { url, opts };
}

const HELP = `http-bench — simple HTTP benchmarking from the terminal

Usage:
  hb <url> [options]

Options:
  -n, --requests <N>      Number of requests (default: 10)
  -c, --concurrency <N>   Concurrent requests (default: 1)
  -m, --method <METHOD>   HTTP method (default: GET)
  -t, --timeout <ms>      Request timeout (default: 10000)
  -f, --format <fmt>      Output: text, json, markdown (default: text)
  -h, --help              Show this help

Examples:
  hb https://example.com
  hb https://api.example.com/health -n 50 -c 5
  hb https://example.com -n 100 -c 10 -f json
  hb https://example.com -m POST -n 20
`;

module.exports = { singleRequest, runBench, formatText, formatJSON, formatMarkdown, parseArgs, HELP };
