"use client";

import { useEffect } from "react";

/**
 * One-time localStorage reset component.
 * Placed in layout so it runs on ANY page visit, not just landing.
 * Bump the version suffix when a full reset is needed.
 */
export function DataReset() {
  useEffect(() => {
    const resetKey = "ttw_reset_v6";
    if (!localStorage.getItem(resetKey)) {
      localStorage.clear();
      localStorage.setItem(resetKey, "1");
      window.location.reload();
    }
  }, []);

  return null;
}
