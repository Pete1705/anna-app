// src/anna/bootstrap.ts

import { loadMemory } from "./memory";

export type BootstrapResult = {
  ok: true;
  sessionId: string;
};

function generateSessionId() {
  return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

/**
 * Bootstrapped ANNA frontend state.
 * - erzeugt eine Session-ID
 * - lädt lokalen Memory-Cache
 * - KEIN Backend-Memory-Zugriff hier
 */
export async function bootstrapAnna(): Promise<BootstrapResult> {
  // Session-ID nur clientseitig
  const sessionId = generateSessionId();

  // Memory laden (lokal, synchron)
  loadMemory();

  return {
    ok: true,
    sessionId,
  };
}
