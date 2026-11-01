# TechZephyr k6 load-test report

Run date: 2026-11-01 (Asia/Kolkata)  
k6: v2.3.0, official `grafana/k6:latest` container  
Target: local production-mode Compose API over `techzephyr4_default`  

## Result

All capacity thresholds passed at up to 50 virtual users. The API returned no
unexpected status codes, no HTTP failures, and no rate-limit responses during
the capacity profile. The API and its PostgreSQL, Redis, and RabbitMQ
dependencies remained healthy after the run, and the API log scan found no
error, fatal, unhandled, or timeout entries.

| Capacity metric | Result |
| --- | ---: |
| Requests | 13,732 |
| Overall request rate (ramps included) | 46.87 req/s |
| Approximate 50-VU steady-stage rate | 92 req/s |
| Iterations | 2,746 |
| Maximum VUs | 50 |
| Checks passed | 13,732 / 13,732 (100%) |
| HTTP failures | 0 / 13,732 (0%) |
| HTTP 429 responses | 0 / 13,730 workload requests (0%) |
| Response time average | 4.14 ms |
| Response time median | 3.95 ms |
| Response time p90 | 5.66 ms |
| Response time p95 | 6.44 ms |
| Response time p99 | 10.25 ms |
| Response time maximum | 294.29 ms |
| Data received | 115.95 MB (395.79 kB/s) |
| Data sent | 5.08 MB (17.34 kB/s) |

The maximum includes setup/login traffic. The five workload endpoints all had
maximum response times below 24 ms.

| Endpoint | Average | p95 | p99 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| `GET /api/v1/dashboard` | 4.41 ms | 6.26 ms | 10.31 ms | 23.81 ms |
| `GET /api/v1/datasets` | 4.49 ms | 6.24 ms | 10.14 ms | 22.24 ms |
| `GET /api/v1/schedules` | 3.38 ms | 5.22 ms | 8.99 ms | 19.77 ms |
| `GET /api/v1/jobs` | 2.91 ms | 4.45 ms | 8.42 ms | 20.25 ms |
| `GET /api/v1/schedules/:id/timetable` | 5.40 ms | 7.09 ms | 11.34 ms | 21.92 ms |

Thresholds: p95 below 500 ms, p99 below 1,000 ms, failures below 1%, checks
above 99%, application errors below 1%, and throttled requests below 0.5%.
Every threshold passed.

## Rate-limit verification

The shared-user profile sent 20 requests/s for 30 seconds against the dashboard.
The observed result matches the configured 120-request burst plus a sustained
refill of two requests/s.

| Rate-limit metric | Result |
| --- | ---: |
| Total HTTP requests, including setup login | 602 (19.88 req/s) |
| Workload iterations | 601 (19.85 req/s) |
| Accepted workload requests | 180 (29.95%) |
| HTTP 429 workload requests | 421 (70.05%) |
| Valid 200-or-429 responses | 601 / 601 (100%) |
| Response time p95 | 3.51 ms |
| Response time p99 | 3.93 ms |

The 69.93% built-in `http_req_failed` value in this profile is expected: k6
classifies HTTP 429 as a failed HTTP request. The custom validity check confirms
that every response was either the expected 200 or expected 429.

## Important finding

The global rate limiter selects its key from the unauthenticated `x-user-id`
header before bearer authentication. A client with one valid token can rotate
that header and obtain a fresh bucket, which is how the capacity test represented
separate users. This also means the production rate limit is bypassable unless
the header is stripped at the edge or the limiter uses the authenticated actor
after authentication. The shared-user test proves that an individual bucket
works correctly; it does not remove this key-selection weakness.

## Scope

This is a local, same-host test, so the numbers measure API/database execution
without Internet latency. It covers authenticated read traffic and the rate
limiter. It does not benchmark schedule generation, repair jobs, write-heavy
flows, frontend rendering, or worker queue capacity.
