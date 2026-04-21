"use client";

import { useEffect } from "react";

/**
 * One-time localStorage reset component.
 * Placed in layout so it runs on ANY page visit, not just landing.
 * Bump the version suffix when a full reset is needed.
 */
export function DataReset() {
  useEffect(() => {
    const resetKey = "ttw_reset_v7";
    if (!localStorage.getItem(resetKey)) {
      // Preserve device identity across resets
      const deviceId = localStorage.getItem("ttw_device_id");
      localStorage.removeItem("ttw_data");
      localStorage.removeItem("ttw_consent");
      localStorage.removeItem("ttw_processed_msgs");
      localStorage.removeItem("ttw_pending_throws");
      // Restore device ID so user keeps one ranking entry
      if (deviceId) localStorage.setItem("ttw_device_id", deviceId);
      localStorage.setItem(resetKey, "1");
      window.location.reload();
    }
  }, []);

  return null;
}
