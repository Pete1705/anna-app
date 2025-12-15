// src/anna/memory.ts
export type Confidence = "low" | "medium" | "high";

export type MemoryItem = {
  type: string;
  key: string;
  value: string;
  confidence?: Confidence;
};

export type MemoryState = {
  memoryId: string | null;
  version: number;
  items: MemoryItem[];
};

const LS_KEY = "anna.memoryState.v1";

function getApiBase(): string {
  // Wichtig: Auf Render-Static-Site MUSS VITE_API_BASE gesetzt sein.
  const base =
    (import.meta as any)?.env?.VITE_API_BASE ||
    (window as any).__ANNA_API_BASE__ ||
    "";

  const cleaned = String(base).trim().replace(/\/$/, "");
  if (!cleaned) {
    throw new Error(
      "VITE_API_BASE fehlt. Setze in Render (Static Site) eine Env-Var: VITE_API_BASE=https://<dein-backend>.onrender.com"
    );
  }
  return cleaned;
}

function apiUrl(path: string) {
  return `${getApiBase()}${path}`;
}

function readLS(): MemoryState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { memoryId: null, version: 0, items: [] };
    const parsed = JSON.parse(raw);

    return {
      memoryId: parsed?.memoryId ?? null,
      version: Number.isFinite(parsed?.version) ? parsed.version : 0,
      items: Array.isArray(parsed?.items) ? parsed.items : [],
    };
  } catch {
    return { memoryId: null, version: 0, items: [] };
  }
}

function writeLS(state: MemoryState) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

export function loadMemory(): MemoryState {
  return readLS();
}

function sanitizeItems(items: MemoryItem[]): MemoryItem[] {
  const cleaned = (items || [])
    .filter(Boolean)
    .map((it) => ({
      type: String((it as any).type ?? "").trim(),
      key: String((it as any).key ?? "").trim(),
      value: String((it as any).value ?? "").trim(),
      confidence: ((it as any).confidence ?? "high") as Confidence,
    }))
    // ✅ HARTE REGEL: nichts Leeres zum Backend
    .filter((it) => it.type && it.key && it.value);

  return cleaned;
}

/**
 * Upsert in Backend (persistiert in DB).
 * Erwartet Backend: POST /api/memory/upsert  body: { items: MemoryItem[] }
 * Antwort: idealerweise { ok:true, memoryId, version, items }
 */
export async function upsertMemoryItems(items: MemoryItem[]) {
  const cleaned = sanitizeItems(items);

  if (cleaned.length === 0) {
    // ✅ Genau dein aktueller Fehler: leere Felder -> Backend 400
    // Wir blocken das hier vorher.
    throw new Error(
      "upsert blocked: type/key/value fehlen (Frontend hat ein leeres Memory-Item erzeugt)"
    );
  }

  const res = await fetch(apiUrl("/api/memory/upsert"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: cleaned }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`upsert failed: ${res.status} ${text}`);
  }

  // Versuche JSON zu lesen – falls Backend plain text liefert, ist das auch ok.
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  // Wenn Backend Memory zurückgibt: in LocalStorage spiegeln.
  if (data && (data.memoryId || data.items || data.version !== undefined)) {
    const next: MemoryState = {
      memoryId: data.memoryId ?? readLS().memoryId ?? null,
      version:
        Number.isFinite(data.version) ? data.version : readLS().version ?? 0,
      items: Array.isArray(data.items) ? data.items : readLS().items ?? [],
    };
    writeLS(next);
  }

  return data ?? { ok: true };
}

/**
 * Reset im Backend + localStorage löschen
 */
export async function resetAnnaStorage() {
  // Backend reset (falls vorhanden)
  try {
    await fetch(apiUrl("/api/memory/reset"), { method: "POST" });
  } catch {
    // egal – wir löschen lokal auf jeden Fall
  }

  localStorage.removeItem(LS_KEY);
}

/**
 * Nur local reset (ohne Backend) – falls du das brauchst.
 */
export function resetLocalMemoryOnly() {
  localStorage.removeItem(LS_KEY);
}
