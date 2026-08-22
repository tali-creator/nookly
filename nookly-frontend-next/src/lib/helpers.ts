import { API_BASE_URL } from "./config";

export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return API_BASE_URL + path;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((x) => x && x[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const DAY_INDEX = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// hours: array of { dayOfWeek 0=Sun..6=Sat, openTime, closeTime, isClosed }
export function isOpenNow(
  hours: { dayOfWeek: number; openTime?: string | null; closeTime?: string | null; isClosed?: boolean }[] | null | undefined,
  timezone?: string | null
): boolean | null {
  if (!hours || !hours.length) return null;
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const hour = parseInt(get("hour") || "0", 10);
  const minute = parseInt(get("minute") || "0", 10);
  const weekdayShort = get("weekday") || "Sun";
  const dayIndex = DAY_INDEX.indexOf(weekdayShort);
  const current = String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");

  const entry = hours.find((h) => h.dayOfWeek === dayIndex);
  if (!entry || entry.isClosed) return false;
  return current >= (entry.openTime || "") && current < (entry.closeTime || "");
}

export function openNowLabel(
  hours: { dayOfWeek: number; openTime?: string | null; closeTime?: string | null; isClosed?: boolean }[] | null | undefined,
  timezone?: string | null
): string {
  const open = isOpenNow(hours, timezone);
  if (open === null) return "Hours unavailable";
  return open ? "Open now" : "Closed now";
}
