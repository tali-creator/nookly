/* ============================================================
   Nookly frontend config
   ============================================================ */

/* ------------------------------------------------------------------
   Single place to set the backend URL.
   - Local dev:            keep as "http://localhost:4000"
   - Deployed (Vercel):    set this to your deployed backend, e.g.
                           "https://nookly-api.onrender.com"
   A page can also override it before config.js loads by setting
   window.NOOKLY_API_BASE_URL.
   ------------------------------------------------------------------ */
const NOOKLY_BACKEND_URL = "http://localhost:4000"

const API_BASE_URL = (typeof window !== "undefined" && window.NOOKLY_API_BASE_URL) || NOOKLY_BACKEND_URL

const STORAGE_KEYS = {
  token: "nookly_token",
  user: "nookly_user",
  deviceId: "nookly_device_id",
}

const FALLBACK_LOCATION = { lat: 6.5244, lng: 3.3792 }
const SEARCH_RADIUS_KM = 10