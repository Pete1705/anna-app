// server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// --- CORS ---
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
app.use(
  cors({
    origin: FRONTEND_ORIGIN === "*" ? true : FRONTEND_ORIGIN,
    credentials: false,
  })
);

// --- DEBUG: ENV prüfen ---
const hasDbUrl = !!process.env.DATABASE_URL;
console.log("[DEBUG] DATABASE_URL present:", hasDbUrl);
if (hasDbUrl) {
  console.log(
    "[DEBUG] DATABASE_URL starts with:",
    process.env.DATABASE_URL.slice(0, 20) + "..."
  );
}

// --- HEALTH ---
app.get("/health", async (_req, res) => {
  let db = false;
  let dbError = null;

  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });

      await pool.query("SELECT 1");
      await pool.end();
      db = true;
    } catch (err) {
      dbError = err.message;
      console.error("[DB ERROR]", err);
    }
  }

  res.json({
    ok: true,
    db,
    dbError,
    time: new Date().toISOString(),
  });
});

// --- START ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
