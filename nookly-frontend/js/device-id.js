/* ============================================================
   Device identity (used for favorites + analytics, anonymous)
   ============================================================ */

function getDeviceId() {
  let id = localStorage.getItem(STORAGE_KEYS.deviceId)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(STORAGE_KEYS.deviceId, id)
  }
  return id
}