# TechZephyr k6 load tests

The capacity profile exercises five authenticated read endpoints with 0 to 50
virtual users. Each VU has a separate rate-limit key and stays below the
documented sustained rate of two requests per second.

```sh
docker run --rm --network techzephyr4_default \
  -v "$PWD/load-tests:/scripts:ro" \
  -v "$PWD/load-tests/results:/results" \
  grafana/k6:latest run \
  --summary-export=/results/capacity-summary.json \
  /scripts/api-capacity.js
```

The second profile sends 20 requests/second through one shared user key for 30
seconds. It confirms that the API's 120-token burst and two requests/second
sustained rate limit returns HTTP 429 under excess load.

```sh
docker run --rm --network techzephyr4_default \
  -v "$PWD/load-tests:/scripts:ro" \
  -v "$PWD/load-tests/results:/results" \
  grafana/k6:latest run \
  --summary-export=/results/rate-limit-summary.json \
  /scripts/rate-limit.js
```

Override `BASE_URL`, `K6_EMAIL`, or `K6_PASSWORD` with k6 `-e` flags when
testing another environment.
