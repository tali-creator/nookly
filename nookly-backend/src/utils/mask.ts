// Masks a sensitive value (e.g. NIN) so only the last `visible` characters
// are shown, e.g. "12345678901" -> "•••••••••01". Production should encrypt
// the raw value at rest; this only limits what leaves the API layer.
export function maskSensitive(value: string | null | undefined, visible = 2): string | null {
  if (!value) return null;
  const clean = String(value).replace(/\s+/g, "");
  if (clean.length <= visible) {
    return "•".repeat(clean.length);
  }
  const dots = "•".repeat(clean.length - visible);
  return dots + clean.slice(-visible);
}