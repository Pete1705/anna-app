import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Test-Route
app.get("/", (req, res) => {
  res.send("Anna-Server läuft ❤️");
});

// Chat-Endpunkt
app.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages
    });

    const answer = response.choices[0].message;
    res.json({ reply: answer });
  } catch (error) {
    console.error("Fehler im /chat-Endpunkt:", error);
    res.status(500).json({ error: "Serverfehler" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Anna-Backend läuft auf http://localhost:${PORT}`);
});
