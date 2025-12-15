import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// ============================
// Middleware
// ============================
app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "*",
  })
);

// ============================
// Health Check
// ============================
app.get("/health", async (req, res) => {
  let dbOk = false;
  let dbError = null;

  try {
    if (process.env.DATABASE_URL) {
      const { default: pkg } = await import("pg");
      const { Client } = pkg;
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();
      await client.end();
      dbOk = true;
    }
  } catch (e) {
    dbError = String(e.message || e);
  }

  res.json({
    ok: true,
    db: dbOk,
    dbError,
    time: new Date().toISOString(),
  });
});

// ============================
// Chat Test (Debug Route)
// ============================
app.get("/api/chat-test", (req, res) => {
  res.json({
    ok: true,
    message: "Chat API reachable",
    time: new Date().toISOString(),
  });
});

// ============================
// Chat Route (ECHTE ANNA)
// ============================
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        ok: false,
        error: "messages array required",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY not set",
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);
      return res.status(500).json({
        ok: false,
        error: data,
      });
    }

    res.json({
      ok: true,
      reply: data.choices[0].message,
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({
      ok: false,
      error: String(err.message || err),
    });
  }
});

// ============================
// Start Server
// ============================
app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
