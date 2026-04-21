import type { AccelSample } from "./types";

const STORAGE_KEY = "ttw_pending_throws";
const MAX_PENDING = 10;

export type PendingThrow = {
  readonly heightMeters: number;
  readonly airtimeSeconds: number;
  readonly sensorSamples: AccelSample[];
  readonly displayName: string;
  readonly queuedAt: number;
};

function readAll(): PendingThrow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingThrow[];
  } catch {
    return [];
  }
}

function writeAll(items: PendingThrow[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage quota exceeded — ignore
  }
}

export function queuePendingThrow(item: Omit<PendingThrow, "queuedAt">): void {
  const all = readAll();
  const entry: PendingThrow = { ...item, queuedAt: Date.now() };
  // Keep within MAX_PENDING by dropping oldest
  const trimmed = [...all, entry].slice(-MAX_PENDING);
  writeAll(trimmed);
}

export function getPendingThrows(): PendingThrow[] {
  return readAll();
}

export function removePendingThrow(queuedAt: number): void {
  const filtered = readAll().filter((item) => item.queuedAt !== queuedAt);
  writeAll(filtered);
}

export function clearAllPending(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
