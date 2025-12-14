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
  memoryId?: string;
  version: number;
  items: MemoryItem[];
};

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE?.replace(/\/$/, "") ||
  ""; // fallback = same-origin (lokal ok, prod braucht ENV)

function apiUrl(path: string) {
  if (!path.startsWith("/")) path = "/" + path;
  return `${API_BASE}${path}`;
}

export async function loadMemory(): Promise<MemoryState> {
  // Backend liefert { ok:true, items:[...] }
  const res = await fetch(apiUrl("/api/memory"), {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`loadMemory failed: ${res.status} ${txt}`);
  }

  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];

  return {
    version: 1,
    items,
  };
}

export async function upsertMemoryItems(patch: MemoryItem[]): Promise<void> {
  // MVP: Wir schicken je Item einen POST (einfach & robust)
  for (const it of patch) {
    const res = await fetch(apiUrl("/api/memory/upsert"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        type: it.type,
        key: it.key,
        value: it.value,
        confidence: it.confidence || "medium",
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`upsert failed: ${res.status} ${txt}`);
    }
  }
}

export async function resetAnnaStorage(): Promise<void> {
  const res = await fetch(apiUrl("/api/memory/reset"), {
    method: "POST",
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`reset failed: ${res.status} ${txt}`);
  }
}
