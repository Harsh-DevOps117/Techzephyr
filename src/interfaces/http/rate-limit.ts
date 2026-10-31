import type { NextFunction, Request, Response } from "express";
import { consumeTokenBucket } from "../../infrastructure/cache/redis-cache.js";

export function rateLimit(scope: string, capacity: number, refillPerSecond: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const actor = req.header("x-user-id") ?? req.ip;
    const verdict = await consumeTokenBucket(`rate-limit:${scope}:${actor}`, capacity, refillPerSecond);
    res.setHeader("RateLimit-Limit", String(capacity));
    res.setHeader("RateLimit-Remaining", String(verdict.remaining));
    if (!verdict.allowed) {
      res.setHeader("Retry-After", String(Math.ceil(1 / refillPerSecond)));
      res.status(429).json({ code: "rate_limited", message: "Too many requests. Please retry shortly." });
      return;
    }
    next();
  };
}
