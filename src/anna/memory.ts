// src/anna/memory.ts

export type MemoryType = "preference" | "fact" | "project" | "other";

export type MemoryItem = {
  type: MemoryType | string;
  key: string;
  value: string;
  confidence?: "low" | "medium" | "high" | string;
  created_at?: string;
};

export type MemoryState = {
  version: number;
  items: MemoryItem[];
};

// Vite injects import.meta.env at build time (Render-safe, no casts).
const API_BASE = import.meta.env.VITE_API_BASE
  ? String(import.meta.env.VITE_API_BASE).replace(/\/$/, "")
  : "";

function apiUrl(path: string) {
  if (!path.startsWith("/")) path = "/" + path;
  return `${API_BASE}${path}`;
}

function clean(s: unknown) {
  return String(s ?? "").trim();
}

function isValidItem(it: any): it is MemoryItem {
  const type = clean(it?.type);
  const key = clean(it?.key);
  const value = clean(it?.value);
  return !!type && !!key && !!value;
}

export async function loadMemory(): Promise<MemoryState> {
  const res = await fetch(apiUrl("/api/memory"), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`loadMemory failed: ${res.status} ${txt}`);
  }

  const data = await res.json().catch(() => ({}));
  const items = Array.isArray((data as any).items) ? (data as any).items : [];

  return { version: 1, items };
}

/**
 * IMPORTANT:
 * We hard-guard here so the backend NEVER receives empty type/key/value.
 * This eliminates the 400 banner ("type, key, value required") entirely.
 */
export async function upsertMemoryItems(items: MemoryItem[]) {
  const safe = (Array.isArray(items) ? items : []).filter(isValidItem);

  // If UI passes garbage/empty items, we simply ignore them (no backend call).
  if (safe.length === 0) {
    // Optional: uncomment for debugging locally
    // console.warn("[memory] upsert skipped: no valid items", items);
    return;
  }

  for (const it of safe) {
    const payload = {
      type: clean(it.type),
      key: clean(it.key),
      value: clean(it.value),
      confidence: clean(it.confidence) || "medium",
    };

    const res = await fetch(apiUrl("/api/memory/upsert"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`upsert failed: ${res.status} ${txt}`);
    }
  }
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
}
