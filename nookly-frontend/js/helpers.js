/* ============================================================
   Shared formatting + data helpers
   ============================================================ */

/* Backend returns photo paths like "/uploads/xxx.png" — prefix with API base. */
function imageUrl(path) {
  if (!path) return null
  if (path.startsWith("http")) return path
  return API_BASE_URL + path
}

/* Backend sends ServiceItem.price as a string like "500.00". */
function parsePrice(value) {
  const n = typeof value === "number" ? value : parseFloat(value)
  return isNaN(n) ? 0 : n
}

function formatNaira(value) {
  return "₦" + Math.round(parsePrice(value)).toLocaleString("en-NG")
}

function initials(name) {
  if (!name) return "?"
  return name.split(" ").map((x) => x && x[0]).filter(Boolean).join("").slice(0, 2).toUpperCase()
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function formatTime(time) {
  if (!time) return "—"
  const [h, m] = time.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return hour + ":" + String(m).padStart(2, "0") + " " + suffix
}

/* hours: array of {dayOfWeek 0=Sun..6=Sat, isClosed, openTime, closeTime} */
function isOpenNow(hours, timezone) {
  if (!hours || !hours.length) return null
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(now)

  const get = (t) => (parts.find((p) => p.type === t) || {}).value
  const hour = parseInt(get("hour"), 10)
  const minute = parseInt(get("minute"), 10)
  const weekdayShort = get("weekday") // Sun, Mon, ...
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayShort)
  const current = String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0")

  const entry = hours.find((h) => h.dayOfWeek === dayIndex)
  if (!entry || entry.isClosed) return false
  return current >= entry.openTime && current < entry.closeTime
}

function openNowLabel(hours, timezone) {
  const open = isOpenNow(hours, timezone)
  if (open === null) return "Hours unavailable"
  return open ? "Open now" : "Closed now"
}

function hoursSummary(hours) {
  if (!hours || !hours.length) return null
  const open = hours.filter((h) => !h.isClosed)
  if (!open.length) return "Closed every day"
  const days = open.map((h) => DAY_NAMES[h.dayOfWeek].slice(0, 3))
  const sample = open[0]
  return days.join(", ") + " · " + formatTime(sample.openTime) + "–" + formatTime(sample.closeTime)
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}