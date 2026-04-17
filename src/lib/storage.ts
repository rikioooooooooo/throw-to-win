// ============================================================
// localStorage wrapper — immutable, type-safe
// ============================================================

import {
  CONSENT_VERSION,
  DEFAULT_LOCALE,
  STORAGE_KEY,
  type AppData,
  type ConsentState,
  type ThrowRecord,
  type UserSettings,
  type UserStats,
} from "./types";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const EMPTY_DATA: AppData = {
  userId: "",
  displayName: "",
  consent: { agreed: false, agreedAt: "", version: CONSENT_VERSION },
  settings: { cameraDirection: "rear", locale: DEFAULT_LOCALE },
  throws: [],
  stats: { personalBest: 0, totalThrows: 0, totalAirtimeSeconds: 0, todayDateISO: "", todayBest: 0, streakDays: 0, lastActiveDateISO: "" },
};

/** Check if localStorage is available */
export function isStorageAvailable(): boolean {
  try {
    const key = "__ttw_test__";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Read full app data from localStorage */
export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initData();
    const parsed = JSON.parse(raw) as AppData;
    // Ensure userId exists
    if (!parsed.userId) return initData();
    // Backward compatibility: fill missing stats fields
    const stats: UserStats = {
      ...parsed.stats,
      todayDateISO: parsed.stats.todayDateISO ?? "",
      todayBest: parsed.stats.todayBest ?? 0,
      streakDays: parsed.stats.streakDays ?? 0,
      lastActiveDateISO: parsed.stats.lastActiveDateISO ?? "",
    };
    return { ...parsed, stats };
  } catch {
    return initData();
  }
}

/** Initialize fresh data with new UUID */
function initData(): AppData {
  const data: AppData = { ...EMPTY_DATA, userId: generateUUID() };
  saveData(data);
  return data;
}

/** Persist full app data */
function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — silent fail
  }
}

/** Record consent */
export function saveConsent(): AppData {
  const data = loadData();
  const consent: ConsentState = {
    agreed: true,
    agreedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  const next: AppData = { ...data, consent };
  saveData(next);
  return next;
}

/** Check if consent is current */
export function hasValidConsent(): boolean {
  const data = loadData();
  return data.consent.agreed && data.consent.version === CONSENT_VERSION;
}

/** Update settings (immutable) */
export function updateSettings(
  partial: Partial<UserSettings>,
): AppData {
  const data = loadData();
  const settings: UserSettings = { ...data.settings, ...partial };
  const next: AppData = { ...data, settings };
  saveData(next);
  return next;
}

/** Maximum stored throw records — prevents localStorage from growing unbounded */
const MAX_STORED_THROWS = 200;

/** Add a throw record and recompute stats */
export function addThrowRecord(
  heightMeters: number,
  airtimeSeconds: number,
): AppData {
  const data = loadData();
  const isPersonalBest = heightMeters > data.stats.personalBest;

  const record: ThrowRecord = {
    id: generateUUID(),
    timestamp: new Date().toISOString(),
    heightMeters,
    airtimeSeconds,
    isPersonalBest,
    submittedToRanking: false,
  };

  // Cap throws at MAX_STORED_THROWS — drop oldest first
  const allThrows = [...data.throws, record];
  const throws: readonly ThrowRecord[] =
    allThrows.length > MAX_STORED_THROWS
      ? allThrows.slice(allThrows.length - MAX_STORED_THROWS)
      : allThrows;

  const todayISO = new Date().toLocaleDateString('sv-SE'); // "2026-04-17" format (ISO)
  const prevDate = data.stats.lastActiveDateISO;
  const prevToday = data.stats.todayDateISO;

  // Today's best
  const isSameDay = prevToday === todayISO;
  const todayBest = isSameDay
    ? Math.max(data.stats.todayBest, heightMeters)
    : heightMeters;

  // Streak calculation
  let streakDays: number;
  if (!prevDate) {
    // First ever throw
    streakDays = 1;
  } else {
    const prevMs = new Date(prevDate).getTime();
    const todayMs = new Date(todayISO).getTime();
    const dayDiff = Math.round((todayMs - prevMs) / (24 * 60 * 60 * 1000));
    if (dayDiff === 0) {
      // Same day — streak unchanged
      streakDays = data.stats.streakDays;
    } else if (dayDiff === 1) {
      // Consecutive day — streak increments
      streakDays = data.stats.streakDays + 1;
    } else {
      // Gap — streak resets
      streakDays = 1;
    }
  }

  const stats: UserStats = {
    personalBest: isPersonalBest ? heightMeters : data.stats.personalBest,
    totalThrows: data.stats.totalThrows + 1,
    totalAirtimeSeconds: data.stats.totalAirtimeSeconds + airtimeSeconds,
    todayDateISO: todayISO,
    todayBest,
    streakDays,
    lastActiveDateISO: todayISO,
  };

  const next: AppData = { ...data, throws, stats };
  saveData(next);
  return next;
}

/** Update display name */
export function saveDisplayName(name: string): AppData {
  const data = loadData();
  const next: AppData = { ...data, displayName: name };
  saveData(next);
  return next;
}

/** Get display name */
export function getDisplayName(): string {
  return loadData().displayName ?? "";
}

/** Get sorted throws (newest first or highest first) */
export function getSortedThrows(
  sortBy: "date" | "height" = "date",
): readonly ThrowRecord[] {
  const data = loadData();
  const arr = [...data.throws];
  if (sortBy === "height") {
    arr.sort((a, b) => b.heightMeters - a.heightMeters);
  } else {
    arr.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }
  return arr;
}
