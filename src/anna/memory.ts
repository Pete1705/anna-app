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

// ✅ HARTE FALLBACK-URL (damit "Failed to fetch" nicht durch localhost passiert)
const HARDCODED_BACKEND = "https://anna-app-6aw4.onrender.com";

// Vite ENV (Render Static Site kann das als Build-ENV setzen)
const RAW_ENV_BASE = (import.meta?.env?.VITE_API_BASE as string) || "";

// Normalize (kein trailing slash)
function normalizeBaseUrl(url: string): string {
  const u = (url || "").trim();
  if (!u) return "";
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

const API_BASE = normalizeBaseUrl(RAW_ENV_BASE) || HARDCODED_BACKEND;

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

export function loadMemory(): MemoryBlob {
  const memoryId = getCachedMemoryId() || "unknown";
  const version = getCachedMemoryVersion();
  const items = getCachedMemoryItems();
  return { memoryId, version, items, updatedAt: nowIso() };
}

export async function upsertMemoryItems(
  patch: Omit<MemoryItem, "lastUpdated">[]
): Promise<MemoryBlob> {
  const memoryId = getCachedMemoryId();
  if (!memoryId) await startSessionAndLoadMemory();

  const mid = getCachedMemoryId();
  if (!mid) throw new Error("No memoryId available after session start.");

  const baseVersion = getCachedMemoryVersion();

  const res = await apiPost<{
    memoryId: string;
    memoryVersion: number;
    items: MemoryItem[];
    updatedAt: string;
  }>("/api/memory/upsert", { memoryId: mid, baseVersion, patch });

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
