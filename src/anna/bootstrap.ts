// src/anna/bootstrap.ts
import { apiUrl, setStoredSessionId } from "./index";
import { loadMemory } from "./memory";

export type AnnaBootstrapResult = {
  sessionId: string;
  memoryId: string;
  memoryVersion: number;
};

export async function bootstrapAnna(): Promise<AnnaBootstrapResult> {
  // 1) Backend bootstrap (wenn vorhanden)
  // Falls du die Route nicht hast, fällt es gleich in den fallback.
  try {
    const res = await fetch(apiUrl("/api/bootstrap"), { method: "GET" });
    const txt = await res.text();
    if (res.ok) {
      const data: any = JSON.parse(txt);
      if (data?.sessionId) setStoredSessionId(data.sessionId);

      // load memory after session established
      const mem = await loadMemory();
      return {
        sessionId: data.sessionId || "—",
        memoryId: mem.memoryId,
        memoryVersion: mem.version,
      };
    }
  } catch {
    // ignore, fallback below
  }

  // 2) Fallback: wenn kein /api/bootstrap existiert,
  // versuchen wir wenigstens /api/memory zu laden (setzt aber Session Header voraus).
  const mem = await loadMemory();
  return {
    sessionId: "—",
    memoryId: mem.memoryId,
    memoryVersion: mem.version,
  };
}
