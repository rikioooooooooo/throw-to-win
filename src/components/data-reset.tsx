"use client";

import { useEffect } from "react";

/**
 * One-time localStorage reset component.
 * Placed in layout so it runs on ANY page visit, not just landing.
 * Bump the version suffix when a full reset is needed.
 */
export function DataReset() {
  useEffect(() => {
    const resetKey = "ttw_reset_v4";
    if (!localStorage.getItem(resetKey)) {
      localStorage.removeItem("ttw_data");
      localStorage.removeItem("ttw_consent");
      localStorage.removeItem("ttw_processed_msgs");
      localStorage.removeItem("ttw_device_id");
      localStorage.setItem(resetKey, "1");
      // Reload so the page picks up clean state
      window.location.reload();
    }
  }, []);

  return null;
}
