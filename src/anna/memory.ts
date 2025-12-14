// src/anna/memory.ts

export type MemoryType = "preference" | "fact" | "project" | "other";

export type MemoryItem = {
  type: MemoryType | string;
  key: string;
  value: string;
  confidence?: "low" | "medium" | "high" | string;
};

export type MemoryState = {
  version: number;
  items: MemoryItem[];
};

/**
 * Vite injects import.meta.env at build time.
 * DO NOT use casts or optional chaining here – breaks Render build.
 */
const API_BASE =
  import.meta.env.VITE_API_BASE
    ? import.meta.env.VITE_API_BASE.replace(/\/$/, "")
    : "";

function apiUrl(path: string) {
  if (!path.startsWith("/")) path = "/" + path;
  return `${API_BASE}${path}`;
}

export async function loadMemory(): Promise<MemoryState> {
  const res = await fetch(apiUrl("/api/memory"));

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`loadMemory failed: ${res.status} ${txt}`);
  }

  const data = await res.json();

  return {
    version: 1,
    items: Array.isArray(data.items) ? data.items : [],
  };
}

export async function upsertMemoryItems(items: MemoryItem[]) {
  for (const it of items) {
    const res = await fetch(apiUrl("/api/memory/upsert"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: it.type,
        key: it.key,
        value: it.value,
        confidence: it.confidence || "medium",
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`upsert failed: ${res.status} ${txt}`);
    }
  }
}

export async function resetAnnaStorage() {
  const res = await fetch(apiUrl("/api/memory/reset"), { method: "POST" });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`reset failed: ${res.status} ${txt}`);
  }
}
