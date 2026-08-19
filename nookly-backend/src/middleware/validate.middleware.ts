import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodSchema } from "zod";

function buildFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "body";
    if (!(key in fields)) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

export function validate(schema: ZodSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        fields: buildFieldErrors(result.error.issues),
      });
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        fields: buildFieldErrors(result.error.issues),
      });
      return;
    }

    // req.query is read-only in Express 5, so expose the parsed value here.
    res.locals.validatedQuery = result.data;
    next();
  };
}
