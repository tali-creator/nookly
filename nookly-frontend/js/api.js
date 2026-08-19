/* ============================================================
   Nookly API client
   ============================================================ */

function getToken() {
  return localStorage.getItem(STORAGE_KEYS.token) || ""
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.token)
  localStorage.removeItem(STORAGE_KEYS.user)
}

function authRedirect() {
  const path = window.location.pathname
  if (path.includes("/admin/")) return "/admin/login.html"
  if (path.includes("/owner/")) return "/owner/login.html"
  return "/login.html"
}

async function apiFetch(method, path, body, opts) {
  const options = { method, headers: {} }
  const token = getToken()
  if (token) options.headers["Authorization"] = "Bearer " + token

  let isForm = false
  if (body instanceof FormData) {
    isForm = true
    options.body = body
  } else if (body !== undefined && body !== null) {
    options.headers["Content-Type"] = "application/json"
    options.body = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(API_BASE_URL + path, options)
  } catch (err) {
    throw { network: true, status: 0, message: "Network error — is the backend running at " + API_BASE_URL + "?" }
  }

  if (res.status === 401 && token) {
    clearSession()
    window.location.href = authRedirect()
    throw { network: false, status: 401, message: "Session expired" }
  }

  let data = null
  const text = await res.text()
  if (text) {
    try { data = JSON.parse(text) } catch { data = null }
  }

  if (!res.ok) {
    throw {
      network: false,
      status: res.status,
      message: (data && data.error) || "Request failed (" + res.status + ")",
      fields: (data && data.fields) || undefined,
      data,
    }
  }

  return { status: res.status, data, text }
}

function apiGet(path) {
  return apiFetch("GET", path, null)
}

function apiPost(path, body) {
  return apiFetch("POST", path, body)
}

function apiPatch(path, body) {
  return apiFetch("PATCH", path, body)
}

function apiPut(path, body) {
  return apiFetch("PUT", path, body)
}

function apiDelete(path, body) {
  return apiFetch("DELETE", path, body)
}