/**
 * Shared server-side utilities for API routes.
 * All functions use Web Crypto API (Cloudflare Workers compatible).
 */

export async function verifyTurnstile(
  token: string,
  secretKey: string,
): Promise<boolean> {
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    },
  );
  const data = (await res.json()) as { success: boolean };
  return data.success;
}

export async function createHmacSignature(
  message: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyHmacSignature(
  message: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  // SHA-256 HMAC = 64 hex characters. Reject anything else early.
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigBytes = new Uint8Array(
    (signature.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)),
  );
  return crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(message));
}
