// server/index.js
import express from "express";
import cors from "cors";

const app = express();
app.use(express.json());

// CORS: im Zweifel offen lassen für MVP, aber per ENV einschränkbar
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
app.use(
  cors({
    origin: FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN,
    credentials: false,
  })
);

// ---- In-Memory DB (MVP) ----
// Achtung: Daten sind weg bei Restart. Für echte Persistenz -> DB (Option 2).
const memories = new Map(); // memoryId -> { memoryId, version, items, updatedAt }
const sessions = new Map(); // sessionId -> { sessionId, memoryId, createdAt, lastSeenAt }

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function upsertItems(existingItems, patch) {
  const map = new Map();
  for (const it of existingItems) map.set(`${it.type}:${it.key}`, it);

  for (const p of patch) {
    map.set(`${p.type}:${p.key}`, { ...p, lastUpdated: nowIso() });
  }

  return Array.from(map.values());
}

// Health
app.get("/health", (_req, res) => {
  res.json({ ok: true, time: nowIso() });
});

// Session start -> returns memory
app.post("/api/session/start", (req, res) => {
  const { sessionId, ownerHint } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: "sessionId missing" });

  let session = sessions.get(sessionId);

  if (!session) {
    const memoryId = randomId("mem");

    const memory = {
      memoryId,
      version: 1,
      items: [],
      updatedAt: nowIso(),
      ownerHint: ownerHint || null,
    };
    memories.set(memoryId, memory);

    session = {
      sessionId,
      memoryId,
      createdAt: nowIso(),
      lastSeenAt: nowIso(),
    };
    sessions.set(sessionId, session);
  } else {
    session.lastSeenAt = nowIso();
    sessions.set(sessionId, session);
  }

  const memory = memories.get(session.memoryId);

  return res.json({
    sessionId: session.sessionId,
    memoryId: memory.memoryId,
    memoryVersion: memory.version,
    items: memory.items,
  });
});

// Memory upsert
app.post("/api/memory/upsert", (req, res) => {
  const { memoryId, baseVersion, patch } = req.body || {};
  if (!memoryId) return res.status(400).json({ error: "memoryId missing" });
  if (!Array.isArray(patch) || patch.length === 0) {
    return res.status(400).json({ error: "patch must be non-empty array" });
  }

  const mem = memories.get(memoryId);
  if (!mem) return res.status(404).json({ error: "memory not found" });

  void baseVersion; // MVP: last write wins

  mem.items = upsertItems(mem.items, patch);
  mem.version += 1;
  mem.updatedAt = nowIso();
  memories.set(memoryId, mem);

  return res.json({
    memoryId: mem.memoryId,
    memoryVersion: mem.version,
    items: mem.items,
    updatedAt: mem.updatedAt,
  });
});

// Memory get
app.get("/api/memory", (req, res) => {
  const { memoryId } = req.query;
  if (!memoryId) return res.status(400).json({ error: "memoryId missing" });

  const mem = memories.get(memoryId);
  if (!mem) return res.status(404).json({ error: "memory not found" });

  return res.json({
    memoryId: mem.memoryId,
    memoryVersion: mem.version,
    items: mem.items,
    updatedAt: mem.updatedAt,
  });
});

// IMPORTANT: Cloud host setzt PORT via ENV
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
