
import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(cors());
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY missing");
}

const genAI = new GoogleGenerativeAI(apiKey);

app.post("/ai-yorum", async (req, res) => {
  try {
    const { title, store } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Ürün adı yok" });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
${title} ürünü hakkında kısa, tarafsız ve kullanıcıya yardımcı bir yorum yaz.
Mağaza: ${store || "Bilinmiyor"}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI hata verdi" });
  }
});

app.get("/health", (req, res) => {
  res.send("OK");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("AI backend running on port", port);
});
