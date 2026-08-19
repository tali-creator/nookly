/* ============================================================
   Auth: token/session management, guards, sign out
   ============================================================ */

function getUser() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "null") } catch { return null }
}

function saveSession(user, token) {
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user))
  localStorage.setItem(STORAGE_KEYS.token, token)
}

/* Redirect to login if there is no valid token. Returns true if guarded. */
function requireAuth(loginPath) {
  if (!getToken()) {
    window.location.href = loginPath
    return true
  }
  return false
}

/* Guard for admin pages: no token -> admin login; wrong role -> kick out. */
function requireAdmin() {
  if (requireAuth("/admin/login.html")) return true
  const user = getUser()
  if (!user || user.role !== "ADMIN") {
    clearSession()
    window.location.href = "/admin/login.html"
    return true
  }
  return false
}

/* Guard for owner pages: no token -> owner login; ADMINS allowed to view. */
function requireOwner() {
  if (requireAuth("/owner/login.html")) return true
  return false
}

function signOut(redirectTo) {
  clearSession()
  window.location.href = redirectTo || "/index.html"
}