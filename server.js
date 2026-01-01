import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// HEALTH CHECK
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// AI YORUM (Gemini – kullanıcı API key)
app.post("/api/ai-yorum", async (req, res) => {
  try {
    const { prompt, apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: "API key eksik" });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: prompt }] }
          ]
        })
      }
    );

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "AI yorum üretilemedi";

    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI hata verdi" });
  }
});

app.listen(PORT, () => {
  console.log(`API çalışıyor : ${PORT}`);
});
