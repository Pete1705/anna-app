// src/anna/bootstrap.ts
import {
  getOrCreateSessionId,
  startSessionAndLoadMemory,
  loadMemory,
} from "./memory";

export type AnnaBootstrapResult = {
  sessionId: string;
  memoryId: string;
  memoryVersion: number;
};

export async function bootstrapAnna(): Promise<AnnaBootstrapResult> {
  const sessionId = getOrCreateSessionId();

  // Erst versuchen, Memory aus Backend zu laden
  try {
    const mem = await startSessionAndLoadMemory();
    return {
      sessionId,
      memoryId: mem.memoryId,
      memoryVersion: mem.version,
    };
  } catch {
    // Fallback: Local Cache (offline-safe)
    const mem = loadMemory();
    return {
      sessionId,
      memoryId: mem.memoryId,
      memoryVersion: mem.version,
    };
  }
}
