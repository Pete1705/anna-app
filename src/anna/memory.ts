// src/anna/memory.ts
import { apiUrl, getStoredSessionId } from "./index";

export type MemoryItem = {
  type: string;
  key: string;
  value: string;
  confidence?: "low" | "medium" | "high";
};

export type MemoryState = {
  memoryId: string;
  version: number;
  items: MemoryItem[];
};

function sessionHeaders(extra?: Record<string, string>) {
  const sid = getStoredSessionId();
  return {
    ...(sid ? { "x-session-id": sid } : {}),
    ...(extra || {}),
  };
}

export async function loadMemory(): Promise<MemoryState> {
  const res = await fetch(apiUrl("/api/memory"), {
    method: "GET",
    headers: sessionHeaders(),
  });

  const txt = await res.text();
  if (!res.ok) throw new Error(`loadMemory failed: ${res.status} ${txt}`);

  let data: any = {};
  try {
    data = JSON.parse(txt);
  } catch {
    // backend should return json; if not, show raw
    throw new Error(`loadMemory invalid JSON: ${txt}`);
  }

  // tolerate backends that only return {ok:true, items:[...]}
  return {
    memoryId: data.memoryId || data.memId || data.id || "—",
    version: typeof data.version === "number" ? data.version : 0,
    items: Array.isArray(data.items) ? data.items : [],
  };
}

/**
 * Backend expected (current in deinem Projekt): {type,key,value,confidence}
 * (Dein früherer Fehler 400 "type, key, value required" bestätigt das)
 */
export async function upsertMemoryItems(items: MemoryItem[]): Promise<{ ok: true }> {
  if (!items || items.length === 0) {
    throw new Error("upsertMemoryItems: no items");
  }

  // sende EIN item (kompatibel)
  const it = items[0];

  const res = await fetch(apiUrl("/api/memory/upsert"), {
    method: "POST",
    headers: sessionHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      type: it.type,
      key: it.key,
      value: it.value,
      confidence: it.confidence || "high",
    }),
  });

  const txt = await res.text();
  if (!res.ok) throw new Error(`upsert failed: ${res.status} ${txt}`);

  return { ok: true };
}

export async function resetAnnaStorage(): Promise<{ ok: true }> {
  // Backend reset (falls Route existiert)
  const res = await fetch(apiUrl("/api/memory/reset"), {
    method: "POST",
    headers: sessionHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });

  const txt = await res.text();
  if (!res.ok) throw new Error(`reset failed: ${res.status} ${txt}`);

  return { ok: true };
}
