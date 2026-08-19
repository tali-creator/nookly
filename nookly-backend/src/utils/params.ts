import type { Request } from "express";

// Express 5 types req.params values as string | string[], but route params
// are always strings in practice. Extract them safely.
export function getParam(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}