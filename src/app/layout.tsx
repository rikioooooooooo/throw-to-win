import type { ReactNode } from "react";

// Root layout delegates html/body to [locale]/layout.tsx
// to avoid nested <html> tags and hydration mismatches.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
