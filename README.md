# http-bench

Simple HTTP benchmarking from the terminal. Hit a URL N times, get timing stats.

No dependencies. Just Node.js ≥ 18.

## Why

`ab` (Apache Bench) and `wrk` are great but not always installed. `hey` requires Go. Sometimes you just want to quickly check how fast an endpoint responds without installing anything extra.

If you have Node.js, you have `http-bench`.

## Install

```bash
npm install -g http-bench
```

Or just run it directly:

```bash
npx http-bench https://example.com -n 20
```

## Usage

```bash
hb <url> [options]
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-n, --requests <N>` | Number of requests | 10 |
| `-c, --concurrency <N>` | Concurrent requests | 1 |
| `-m, --method <METHOD>` | HTTP method | GET |
| `-t, --timeout <ms>` | Request timeout | 10000 |
| `-f, --format <fmt>` | Output: text, json, markdown | text |
| `-h, --help` | Show help | |

### Examples

Quick health check:
```bash
hb https://api.example.com/health
```

Load test with 50 requests, 5 at a time:
```bash
hb https://api.example.com -n 50 -c 5
```

Get JSON output for scripting:
```bash
hb https://api.example.com -n 100 -f json | jq '.stats.p95'
```

Generate a markdown report:
```bash
hb https://api.example.com -n 20 -f markdown >> report.md
```

## Sample Output

```
Benchmark: https://api.example.com/health
  10 requests, concurrency 1, method GET

  Latency:
    min:    45.23 ms
    mean:   62.78 ms
    median: 58.91 ms
    max:    120.44 ms
  Percentiles:
    p50: 58.91 ms
    p90: 98.12 ms
    p95: 110.33 ms
    p99: 118.90 ms
  Throughput: 15.92 req/s
  Total time: 627.83 ms
  Avg bytes:  42
  Status codes:
    200: 10
```

## Programmatic API

```javascript
const { runBench, formatText } = require("http-bench");

const data = await runBench("https://example.com", {
  requests: 50,
  concurrency: 5,
  timeout: 10000
}, (done, total) => {
  console.log(`${done}/${total}`);
});

console.log(formatText("https://example.com", { requests: 50 }, data));
```

## What It Measures

- **Latency**: min, mean, median, max for successful requests
- **Percentiles**: p50, p90, p95, p99
- **Throughput**: requests per second
- **Status codes**: breakdown of response codes
- **Errors**: connection failures, timeouts

## License

MIT
