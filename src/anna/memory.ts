// src/anna/memory.ts

export type Confidence = "low" | "medium" | "high";
export type MemoryType = "preference" | "fact" | "project" | "other";

export type MemoryItem = {
  type: MemoryType | string;
  key: string;
  value: string;
  confidence?: Confidence | string;
  created_at?: string;
};

export type MemoryState = {
  memoryId: string;
  version: number;
  items: MemoryItem[];
};

const LS_SESSION = "anna.sessionId";
const LS_MEMORY_ID = "anna.memoryId";
const LS_MEMORY_VERSION = "anna.memoryVersion";

// Render/Vite-safe: no casts, no optional chaining on import.meta
const API_BASE = import.meta.env.VITE_API_BASE
  ? String(import.meta.env.VITE_API_BASE).replace(/\/$/, "")
  : "";

function apiUrl(path: string) {
  if (!path.startsWith("/")) path = "/" + path;
  return `${API_BASE}${path}`;
}

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

// ✅ required by bootstrap.ts (your errors)
export function getOrCreateSessionId() {
  const existing = localStorage.getItem(LS_SESSION);
  if (existing) return existing;
  const id = randomId("sess");
  localStorage.setItem(LS_SESSION, id);
  return id;
}

function getOrCreateMemoryId() {
  const existing = localStorage.getItem(LS_MEMORY_ID);
  if (existing) return existing;
  const id = randomId("mem");
  localStorage.setItem(LS_MEMORY_ID, id);
  if (!localStorage.getItem(LS_MEMORY_VERSION)) localStorage.setItem(LS_MEMORY_VERSION, "1");
  return id;
}

function getMemoryVersion() {
  const raw = localStorage.getItem(LS_MEMORY_VERSION);
  const n = raw ? Number(raw) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function bumpMemoryVersion() {
  const next = getMemoryVersion() + 1;
  localStorage.setItem(LS_MEMORY_VERSION, String(next));
  return next;
}

function isValidItem(it: any): it is MemoryItem {
  const type = clean(it?.type);
  const key = clean(it?.key);
  const value = clean(it?.value);
  return !!type && !!key && !!value;
}

// ✅ backend load
export async function loadMemory(): Promise<MemoryState> {
  const memoryId = getOrCreateMemoryId();
  const version = getMemoryVersion();

  const res = await fetch(apiUrl("/api/memory"), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`loadMemory failed: ${res.status} ${txt}`);
  }

  const data = await res.json().catch(() => ({} as any));
  const items = Array.isArray((data as any).items) ? (data as any).items : [];

  return { memoryId, version, items };
}

// ✅ used by index.ts (your errors)
export async function startSessionAndLoadMemory() {
  const sessionId = getOrCreateSessionId();
  const mem = await loadMemory();
  return { sessionId, ...mem };
}

// ✅ HARD GUARD -> prevents your 400 banner forever
export async function upsertMemoryItems(items: MemoryItem[]) {
  const safe = (Array.isArray(items) ? items : []).filter(isValidItem);

  // if UI sends empty payloads -> do nothing (prevents 400)
  if (safe.length === 0) return;

  for (const it of safe) {
    const payload = {
      type: clean(it.type),
      key: clean(it.key),
      value: clean(it.value),
      confidence: (clean(it.confidence) as Confidence) || "medium",
    };

    const res = await fetch(apiUrl("/api/memory/upsert"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`upsert failed: ${res.status} ${txt}`);
    }
  }

  bumpMemoryVersion();
}

// ✅ required by bootstrap.ts (your errors)
export async function rememberPreference(
  key: string,
  value: string,
  confidence: Confidence = "high"
) {
  return upsertMemoryItems([{ type: "preference", key, value, confidence }]);
}

export async function resetAnnaStorage() {
  const res = await fetch(apiUrl("/api/memory/reset"), {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`reset failed: ${res.status} ${txt}`);
  }

  localStorage.removeItem(LS_MEMORY_ID);
  localStorage.removeItem(LS_MEMORY_VERSION);
  bumpMemoryVersion();
}
