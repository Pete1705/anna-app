// src/anna/memory.ts
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

// ✅ feste Backend URL (Render)
const API_BASE = "https://anna-app-6aw4.onrender.com";

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
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

export function loadMemory(): MemoryBlob {
  const memoryId = localStorage.getItem(LS.memoryId) || "unknown";
  const version = Number(localStorage.getItem(LS.memoryVersion) || "1");
  const items = readJson<MemoryItem[]>(LS.memoryItems, []);
  return { memoryId, version, items, updatedAt: nowIso() };
}

function cacheMemory(mem: MemoryBlob) {
  localStorage.setItem(LS.memoryId, mem.memoryId);
  localStorage.setItem(LS.memoryVersion, String(mem.version));
  writeJson(LS.memoryItems, mem.items);
}

async function api<T>(path: string, method: "GET" | "POST", body?: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${method} ${path} failed: ${res.status} ${txt}`);
  }
  return (await res.json()) as T;
}

export async function startSessionAndLoadMemory(): Promise<MemoryBlob> {
  const sessionId = getOrCreateSessionId();

  const data = await api<{
    sessionId: string;
    memoryId: string;
    memoryVersion: number;
    items: MemoryItem[];
  }>("/api/session/start", "POST", { sessionId, ownerHint: "pete" });

  const mem: MemoryBlob = {
    memoryId: data.memoryId,
    version: data.memoryVersion,
    items: data.items || [],
    updatedAt: nowIso(),
  };

  cacheMemory(mem);
  return mem;
}

export async function upsertMemoryItems(
  patch: Omit<MemoryItem, "lastUpdated">[]
): Promise<MemoryBlob> {
  const memoryId = localStorage.getItem(LS.memoryId);
  const baseVersion = Number(localStorage.getItem(LS.memoryVersion) || "1");

  const res = await api<{
    memoryId: string;
    memoryVersion: number;
    items: MemoryItem[];
    updatedAt: string;
  }>("/api/memory/upsert", "POST", { memoryId, baseVersion, patch });

  const mem: MemoryBlob = {
    memoryId: res.memoryId,
    version: res.memoryVersion,
    items: res.items || [],
    updatedAt: res.updatedAt || nowIso(),
  };

  cacheMemory(mem);
  return mem;
}

export function resetAnnaStorage() {
  Object.values(LS).forEach((k) => localStorage.removeItem(k));
}
