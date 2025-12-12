// src/anna/bootstrap.ts
import { getOrCreateSessionId, loadMemory, startSessionAndLoadMemory, rememberPreference } from "./memory";

export type AnnaBootstrapResult = {
  sessionId: string;
  memoryId: string;
  memoryVersion: number;
};

export async function bootstrapAnna(): Promise<AnnaBootstrapResult> {
  const sessionId = getOrCreateSessionId();

  // Backend Source-of-Truth laden und cache aktualisieren
  const mem = await startSessionAndLoadMemory();

  // Defaults nur setzen, wenn Backend noch leer ist
  if (mem.version === 1 && mem.items.length === 0) {
    await rememberPreference("code_delivery", "Immer vollständigen Code zum Austauschen", "high");
    await rememberPreference("workflow", "Schritt-für-Schritt Anleitung", "high");
  }

  const latest = loadMemory();
  return {
    sessionId,
    memoryId: latest.memoryId,
    memoryVersion: latest.version,
  };
}
