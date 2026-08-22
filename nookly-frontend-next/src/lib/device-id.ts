// Anonymous device identity — used for favorites + analytics, ties to the
// same concept as the original device-id.js (persisted in localStorage).
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem("nookly_device_id");
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem("nookly_device_id", id);
    }
    return id;
  } catch {
    return "";
  }
}
