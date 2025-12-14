// src/anna/bootstrap.ts

import {
  getOrCreateSessionId,
  loadMemory,
  rememberPreference,
} from "./memory";

export type AnnaBootstrapResult = {
  sessionId: string;
  memoryId: string;
  memoryVersion: number;
};

export async function bootstrapAnna(): Promise<AnnaBootstrapResult> {
  const sessionId = getOrCreateSessionId();
  const mem = await loadMemory();

  // Optional: set defaults on first run only
  // (first run = version===1 and no items)
  if (mem.version === 1 && mem.items.length === 0) {
    await rememberPreference("code_delivery", "Immer vollständigen Code zum Austauschen", "high");
    await rememberPreference("workflow", "Schritt-für-Schritt Anleitung", "high");
  }

  const latest = await loadMemory();

  return {
    sessionId,
    memoryId: latest.memoryId,
    memoryVersion: latest.version,
  };
}
