import { Resend } from "resend";
import { env } from "../../config/env";

let client: Resend | null = null;

// Lazy singleton. Returns null (never throws) when no API key is configured,
// so callers can fall back to logging.
export function getResend(): Resend | null {
  if (!env.resendApiKey) {
    return null;
  }
  if (!client) {
    client = new Resend(env.resendApiKey);
  }
  return client;
}
