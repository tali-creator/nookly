"use client";

import { useEffect } from "react";
import { apiPost } from "@/lib/api";
import { getDeviceId } from "@/lib/device-id";

/* Fires a PROFILE_VIEW analytics event when a business profile is viewed.
   Mounted on the public business detail page. Fire-and-forget: failures are
   swallowed so they never block rendering. */
export default function TrackBusinessView({ businessId }: { businessId: string }) {
  useEffect(() => {
    if (!businessId) return;
    apiPost(`/businesses/${businessId}/events`, {
      type: "PROFILE_VIEW",
      deviceId: getDeviceId(),
    }).catch(() => {});
  }, [businessId]);

  return null;
}
