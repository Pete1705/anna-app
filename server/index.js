// server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// ENV laden
dotenv.config();

// 🔍 DEBUG: Prüfen ob DATABASE_URL wirklich ankommt
console.log(
  "DATABASE_URL =",
  process.env.DATABASE_URL ? "SET" : "MISSING"
);

const app = express();
app.use(express.json());

// CORS
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
app.use(
  cors({
    origin: FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN,
    credentials: false,
  })
);

// ---- In-Memory Fallback (nur wenn DB fehlt) ----
const memories = new Map(); // memoryId -> { items, updatedAt }
const sessions = new Map(); // sessionId -> { sessionId, memoryId, createdAt }

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(
    16
  )}`;
}

// ---- Health Check ----
app.get("/health", async (req, res) => {
  let db = false;

  try {
    if (process.env.DATABASE_URL) {
      const { default: pg } = await import("pg");
      const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      db = true;
    }
  } catch (e) {
    console.error("DB health check failed:", e.message);
  }

  res.json({
    ok: true,
    db,
    time: nowIso(),
  });
});

// ---- Minimal API (Memory MVP) ----
app.post("/memory/load", (req, res) => {
  const sessionId = req.body.sessionId || randomId("session");

  let session = sessions.get(sessionId);
  if (!session) {
    const memoryId = randomId("memory");
    session = {
      sessionId,
      memoryId,
      createdAt: nowIso(),
    };
    sessions.set(sessionId, session);
    memories.set(memoryId, { items: [], updatedAt: nowIso() });
  }

  const memory = memories.get(session.memoryId);
  res.json({
    sessionId: session.sessionId,
    memoryId: session.memoryId,
    items: memory.items,
  });
});

app.post("/memory/upsert", (req, res) => {
  const { memoryId, items = [] } = req.body;
  if (!memoryId) {
    return res.status(400).json({ error: "memoryId missing" });
  }

  const memory = memories.get(memoryId) || { items: [], updatedAt: nowIso() };
  memory.items = items;
  memory.updatedAt = nowIso();
  memories.set(memoryId, memory);

  res.json({ ok: true });
});

// ---- Start Server ----
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ANNA backend running on port ${PORT}`);
});
