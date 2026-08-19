import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { HttpError } from "../utils/http-error";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

// body-parser (express.json) rejects oversized bodies with a PayloadTooLarge
// error carrying `status: 413`. Detect it by shape rather than by class, since
// the error class is not exported in a stable way across body-parser versions.
function isBodyParserError(err: unknown): err is Error & { status?: number; type?: string } {
  return (
    err instanceof Error &&
    typeof (err as { status?: unknown }).status === "number" &&
    (err as { type?: string }).type === "entity.too.large"
  );
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File too large (max 5MB)"
        : err.message;
    res.status(400).json({ error: message });
    return;
  }
  if (isBodyParserError(err)) {
    res.status(413).json({ error: "Request body too large" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
