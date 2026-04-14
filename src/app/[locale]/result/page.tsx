"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Result is shown inline in the play page, not as a separate route.
// This page redirects back to the landing page.
export default function ResultPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("./");
  }, [router]);

  return null;
}
