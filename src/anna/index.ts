// src/anna/index.ts

const DEFAULT_API_BASE = "";

/**
 * In Vite: import.meta.env.VITE_API_BASE (Build-time!)
 * - Lokal: leer lassen => relative /api/...
 * - Render Static Site: VITE_API_BASE auf Backend-URL setzen (https://...onrender.com)
 */
export function getApiBase(): string {
  const v = (import.meta as any)?.env?.VITE_API_BASE;
  if (typeof v === "string" && v.trim()) return v.trim().replace(/\/+$/, "");
  return DEFAULT_API_BASE;
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  if (!path.startsWith("/")) path = "/" + path;
  return base ? `${base}${path}` : path;
}

// SessionId Storage (Frontend-seitig)
const SESSION_KEY = "anna.sessionId";

export function getStoredSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionId(sessionId: string) {
  try {
    localStorage.setItem(SESSION_KEY, sessionId);
  } catch {}
}

export function clearStoredSessionId() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
}
