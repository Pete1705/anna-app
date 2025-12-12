// src/anna/memory.ts
// Backend-Source-of-Truth + LocalStorage Cache (Hybrid)

export type MemoryType = "user" | "project" | "preference";
export type Confidence = "high" | "medium";

export type MemoryItem = {
  type: MemoryType;
  key: string;
  value: string;
  confidence: Confidence;
  lastUpdated: string;
};

export type MemoryBlob = {
  memoryId: string;
  version: number;
  items: MemoryItem[];
  updatedAt: string;
};

const LS = {
  sessionId: "anna.sessionId",
  memoryId: "anna.memoryId",
  memoryVersion: "anna.memoryVersion",
  memoryItems: "anna.memoryItems",
} as const;

// Backend base URL (kannst du auch in .env legen)
const API_BASE = "http://localhost:3001";

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getOrCreateSessionId(): string {
  const v = localStorage.getItem(LS.sessionId);
  if (v && v.trim()) return v;
  const sid = randomId("sess");
  localStorage.setItem(LS.sessionId, sid);
  return sid;
}

// ---- Cache accessors (LocalStorage) ----
export function getCachedMemoryId(): string | null {
  const v = localStorage.getItem(LS.memoryId);
  return v && v.trim() ? v : null;
}

export function getCachedMemoryVersion(): number {
  const v = Number(localStorage.getItem(LS.memoryVersion) || "1");
  return Number.isFinite(v) && v > 0 ? v : 1;
}

export function getCachedMemoryItems(): MemoryItem[] {
  return readJson<MemoryItem[]>(LS.memoryItems, []);
}

function cacheMemory(mem: MemoryBlob) {
  localStorage.setItem(LS.memoryId, mem.memoryId);
  localStorage.setItem(LS.memoryVersion, String(mem.version));
  writeJson(LS.memoryItems, mem.items);
}

// ---- Backend API ----
async function apiPost<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`POST ${path} failed: ${res.status} ${txt}`);
  }

  return (await res.json()) as T;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: "GET" });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GET ${path} failed: ${res.status} ${txt}`);
  }

  return (await res.json()) as T;
}

// ---- Public API used by the app ----

/**
 * Startet/Bindet Session im Backend.
 * Lädt Memory (Source of Truth) und cached es.
 *
 * Diese Funktion wird in bootstrap.ts verwendet.
 */
export async function startSessionAndLoadMemory(): Promise<MemoryBlob> {
  const sessionId = getOrCreateSessionId();

  const data = await apiPost<{
    sessionId: string;
    memoryId: string;
    memoryVersion: number;
    items: MemoryItem[];
  }>("/api/session/start", { sessionId, ownerHint: "pete" });

  const mem: MemoryBlob = {
    memoryId: data.memoryId,
    version: data.memoryVersion,
    items: data.items || [],
    updatedAt: nowIso(),
  };

  cacheMemory(mem);
  return mem;
}

/**
 * Lädt Memory aus Cache (schnell, offline-freundlich).
 * Für "aktuelles" Memory nutzt du startSessionAndLoadMemory() beim Boot
 * und upsertMemoryItems() beim Speichern.
 */
export function loadMemory(): MemoryBlob {
  const memoryId = getCachedMemoryId() || "unknown";
  const version = getCachedMemoryVersion();
  const items = getCachedMemoryItems();
  return { memoryId, version, items, updatedAt: nowIso() };
}

/**
 * Upsert -> Backend, dann Cache aktualisieren.
 */
export async function upsertMemoryItems(
  patch: Omit<MemoryItem, "lastUpdated">[]
): Promise<MemoryBlob> {
  const memoryId = getCachedMemoryId();
  if (!memoryId) {
    // Falls Cache leer: Session starten und Memory holen
    await startSessionAndLoadMemory();
  }

  const mid = getCachedMemoryId();
  if (!mid) throw new Error("No memoryId available after session start.");

  const baseVersion = getCachedMemoryVersion();

  const res = await apiPost<{
    memoryId: string;
    memoryVersion: number;
    items: MemoryItem[];
    updatedAt: string;
  }>("/api/memory/upsert", {
    memoryId: mid,
    baseVersion,
    patch,
  });

  const mem: MemoryBlob = {
    memoryId: res.memoryId,
    version: res.memoryVersion,
    items: res.items || [],
    updatedAt: res.updatedAt || nowIso(),
  };

  cacheMemory(mem);
  return mem;
}

export async function fetchMemoryFromBackend(): Promise<MemoryBlob> {
  const mid = getCachedMemoryId();
  if (!mid) throw new Error("No memoryId in cache.");

  const res = await apiGet<{
    memoryId: string;
    memoryVersion: number;
    items: MemoryItem[];
    updatedAt: string;
  }>(`/api/memory?memoryId=${encodeURIComponent(mid)}`);

  const mem: MemoryBlob = {
    memoryId: res.memoryId,
    version: res.memoryVersion,
    items: res.items || [],
    updatedAt: res.updatedAt || nowIso(),
  };

  cacheMemory(mem);
  return mem;
}

export function resetAnnaStorage(): void {
  Object.values(LS).forEach((k) => localStorage.removeItem(k));
}

// Convenience helpers (optional)
export async function rememberPreference(
  key: string,
  value: string,
  confidence: Confidence = "high"
) {
  return upsertMemoryItems([{ type: "preference", key, value, confidence }]);
}

export async function rememberProject(
  key: string,
  value: string,
  confidence: Confidence = "high"
) {
  return upsertMemoryItems([{ type: "project", key, value, confidence }]);
}

export async function rememberUser(
  key: string,
  value: string,
  confidence: Confidence = "high"
) {
  return upsertMemoryItems([{ type: "user", key, value, confidence }]);
}
