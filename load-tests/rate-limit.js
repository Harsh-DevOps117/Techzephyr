import http from "k6/http";
import { check } from "k6";
import { Counter, Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://api:3000";
const EMAIL = __ENV.K6_EMAIL || "admin@cit.local";
const PASSWORD = __ENV.K6_PASSWORD || "TechZephyr!2026";

const acceptedRequests = new Counter("accepted_requests");
const rateLimitedRequests = new Counter("rate_limited_requests");
const validResponses = new Rate("valid_responses");
const rateLimited = new Rate("rate_limited");

export const options = {
  scenarios: {
    shared_user_burst: {
      executor: "constant-arrival-rate",
      rate: 20,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 10,
      maxVUs: 30,
    },
  },
  thresholds: {
    checks: ["rate>0.99"],
    valid_responses: ["rate>0.99"],
    rate_limited: ["rate>0.50"],
  },
  summaryTrendStats: ["avg", "med", "min", "max", "p(90)", "p(95)", "p(99)"],
  userAgent: "TechZephyr-k6-rate-limit/1.0",
};

export function setup() {
  const login = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    {
      headers: {
        "Content-Type": "application/json",
        "x-user-id": "k6-rate-limit-setup",
      },
      tags: { name: "POST /api/v1/auth/login" },
    },
  );
  if (login.status !== 200) {
    throw new Error(`Login failed with HTTP ${login.status}: ${login.body}`);
  }
  return { token: login.json("accessToken") };
}

export default function (data) {
  const response = http.get(`${BASE_URL}/api/v1/dashboard`, {
    headers: {
      Authorization: `Bearer ${data.token}`,
      "x-user-id": "k6-shared-user-rate-test",
      Accept: "application/json",
    },
    tags: { name: "GET /api/v1/dashboard [shared user]" },
  });

  const accepted = response.status === 200;
  const throttled = response.status === 429;
  acceptedRequests.add(accepted ? 1 : 0);
  rateLimitedRequests.add(throttled ? 1 : 0);
  validResponses.add(accepted || throttled);
  rateLimited.add(throttled);
  check(response, { "response is accepted or rate-limited": () => accepted || throttled });
}
