// server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

const app = express();
app.use(express.json());

// --------------------
// CORS
// --------------------
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
app.use(
  cors({
    origin: FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN,
  })
);

// --------------------
// Postgres
// --------------------
let pool = null;
let dbReady = false;
let dbError = null;

try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing");
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS memory_items (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      confidence TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  dbReady = true;
  console.log("[db] connected & table ready");
} catch (err) {
  dbError = err.message;
  console.error("[db] error:", err.message);
}

// --------------------
// Health
// --------------------
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    db: dbReady,
    dbError,
    time: new Date().toISOString(),
  });
});

// --------------------
// MEMORY API (FINAL)
// --------------------

// GET all memory
app.get("/api/memory", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM memory_items ORDER BY created_at DESC"
    );
    res.json({ ok: true, items: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// UPSERT memory
app.post("/api/memory/upsert", async (req, res) => {
  const { type, key, value, confidence } = req.body;

  if (!type || !key || !value) {
    return res
      .status(400)
      .json({ ok: false, error: "type, key, value required" });
  }

  try {
    await pool.query(
      `
      INSERT INTO memory_items (type, key, value, confidence)
      VALUES ($1, $2, $3, $4)
      `,
      [type, key, value, confidence || "medium"]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// RESET memory
app.post("/api/memory/reset", async (req, res) => {
  try {
    await pool.query("DELETE FROM memory_items");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --------------------
// Start
// --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
