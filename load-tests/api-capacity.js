import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://api:3000";
const EMAIL = __ENV.K6_EMAIL || "admin@cit.local";
const PASSWORD = __ENV.K6_PASSWORD || "TechZephyr!2026";

const apiErrors = new Rate("api_errors");
const throttledRequests = new Rate("throttled_requests");
const dashboardDuration = new Trend("dashboard_duration", true);
const datasetsDuration = new Trend("datasets_duration", true);
const schedulesDuration = new Trend("schedules_duration", true);
const jobsDuration = new Trend("jobs_duration", true);
const timetableDuration = new Trend("timetable_duration", true);

export const options = {
  scenarios: {
    authenticated_reads: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 10 },
        { duration: "30s", target: 25 },
        { duration: "1m", target: 25 },
        { duration: "30s", target: 50 },
        { duration: "1m", target: 50 },
        { duration: "20s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    checks: ["rate>0.99"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    api_errors: ["rate<0.01"],
    throttled_requests: ["rate<0.005"],
  },
  summaryTrendStats: ["avg", "med", "min", "max", "p(90)", "p(95)", "p(99)"],
  noConnectionReuse: false,
  userAgent: "TechZephyr-k6-capacity/1.0",
};

export function setup() {
  const login = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    {
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "k6-setup-login",
      },
      tags: { name: "POST /api/v1/auth/login" },
    },
  );

  if (!check(login, { "setup login returned 200": (response) => response.status === 200 })) {
    throw new Error(`Login failed with HTTP ${login.status}: ${login.body}`);
  }

  const token = login.json("accessToken");
  const schedules = http.get(`${BASE_URL}/api/v1/schedules`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-user-id": "k6-setup-schedules",
    },
    tags: { name: "GET /api/v1/schedules [setup]" },
  });

  if (!check(schedules, { "setup schedules returned 200": (response) => response.status === 200 })) {
    throw new Error(`Schedule discovery failed with HTTP ${schedules.status}: ${schedules.body}`);
  }

  const items = schedules.json("items");
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("The load test needs at least one schedule in the demo database");
  }

  const ready = items.find((item) => item.status !== "generating" && item.status !== "failed") || items[0];
  return { token, scheduleId: ready.id };
}

function record(response, durationMetric) {
  const successful = response.status === 200;
  durationMetric.add(response.timings.duration);
  apiErrors.add(!successful);
  throttledRequests.add(response.status === 429);
  check(response, { "response status is 200": () => successful });
}

export default function (data) {
  // The application rate limiter keys requests by x-user-id before bearer-token
  // authentication. A stable key per VU models separate users while the bearer
  // token supplies the real authenticated admin identity.
  const headers = {
    Authorization: `Bearer ${data.token}`,
    "x-user-id": `k6-capacity-vu-${__VU}`,
    Accept: "application/json",
  };

  const responses = http.batch([
    ["GET", `${BASE_URL}/api/v1/dashboard`, null, { headers, tags: { name: "GET /api/v1/dashboard" } }],
    ["GET", `${BASE_URL}/api/v1/datasets`, null, { headers, tags: { name: "GET /api/v1/datasets" } }],
    ["GET", `${BASE_URL}/api/v1/schedules`, null, { headers, tags: { name: "GET /api/v1/schedules" } }],
    ["GET", `${BASE_URL}/api/v1/jobs`, null, { headers, tags: { name: "GET /api/v1/jobs" } }],
    ["GET", `${BASE_URL}/api/v1/schedules/${data.scheduleId}/timetable`, null, { headers, tags: { name: "GET /api/v1/schedules/:id/timetable" } }],
  ]);

  record(responses[0], dashboardDuration);
  record(responses[1], datasetsDuration);
  record(responses[2], schedulesDuration);
  record(responses[3], jobsDuration);
  record(responses[4], timetableDuration);

  // Five requests per iteration and a 2.7 s think time keep each simulated user
  // below the documented sustained limit of two requests per second.
  sleep(2.7);
}
