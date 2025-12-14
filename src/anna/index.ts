// src/anna/index.ts

// 🔥 HARDCODE FALLBACK (nur wenn VITE_API_BASE nicht gesetzt ist)
// -> damit funktioniert Render sofort, auch wenn Env mal wieder "nicht greift".
const FALLBACK_RENDER_BACKEND = "https://anna-app-6aw4.onrender.com";

export function getApiBase(): string {
  // 1) Vite Env (Build-time)
  const v = (import.meta as any)?.env?.VITE_API_BASE;
  if (typeof v === "string" && v.trim()) return v.trim().replace(/\/+$/, "");

  // 2) Fallback: wenn nicht localhost, nimm Render Backend
  // (damit die Static Site nicht /api/... auf sich selbst aufruft)
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local");
    if (!isLocal) return FALLBACK_RENDER_BACKEND;
  }

  // 3) Lokal: relative API (Proxy/gleiche Origin)
  return "";
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
