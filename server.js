import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/ai/yorum", async (req, res) => {
  try {
    const { title, price, site } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: "Ürün başlığı yok" });
    }

    const yorum = `
${title} ürünü ${site || "pazar yerinde"} listelenmektedir.
${price ? `Yaklaşık fiyat: ${price} TL` : ""}
Genel olarak fiyat/performans açısından değerlendirilebilir.
    `.trim();

    res.json({ success: true, yorum });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, yorum: "AI yorumu alınamadı" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("API çalışıyor:", PORT));
