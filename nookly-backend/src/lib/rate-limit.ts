import type { NextFunction, Request, RequestHandler, Response } from "express";

// Simple in-memory sliding-window rate limiter keyed by arbitrary strings.
//
// KNOWN LIMITATION (accepted for the current deployment):
//   - Single-process, in-memory only. Buckets live in a module-level Map and
//     are lost on any process restart, so ALL rate limits reset whenever the
//     service restarts (e.g. deploys, server reboot, nodemon reload).
//   - State is not shared across instances. Running more than one backend
//     process behind a load balancer would give each instance its own bucket
//     set, letting a client exceed the intended limit by the instance count.
//
// This is fine for the current single-instance development/production
// deployment, where a restart simply resets limits and a single process
// provides one shared view of the buckets. BEFORE scaling horizontally,
// replace this implementation with a shared backing store (e.g. Redis) so the
// limit holds across instances AND survives restarts. The call sites
// (createRateLimiter consumers) do not need to change for that swap.
const buckets = new Map<string, number[]>();

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  // Returns the key to rate limit on, or null if there is nothing to key on
  // (the request is then passed through and handled by validation).
  getKey: (req: Request) => string | null;
  message?: string;
}

// Returns true if the request is over the limit, false if allowed.
export function rateLimitHit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  const recent = (buckets.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= max) {
    return true;
  }

  recent.push(now);
  if (recent.length === 0) {
    // Nothing expired to keep; drop the key so the map stays bounded.
    buckets.delete(key);
  } else {
    buckets.set(key, recent);
  }
  return false;
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = options.getKey(req);
    if (!key) {
      next();
      return;
    }

    if (rateLimitHit(key, options.max, options.windowMs)) {
      res.status(429).json({
        error: options.message ?? "Too many requests, please try again later",
      });
      return;
    }
    next();
  };
}