import type { Request } from "express";

// Best-effort client IP for rate limiting. Express fills req.ip from the
// socket when no reverse proxy is involved. When deployed behind a proxy/CDN,
// the app must opt into trusting proxies (app.set("trust proxy", ...)) so that
// req.ip resolves to the real client address rather than the proxy. The
// X-Forwarded-For header is NEVER trusted unconditionally: it is attacker-
// spoofable unless the proxy is configured to overwrite it. Documented trust
// assumption: this app runs directly behind the client in dev, so req.ip is
// the peer socket address. In production behind a proxy, set trust proxy and
// keep X-Forwarded-For controlled by the proxy.
export function clientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}