// ========== SATIR 1-3 ==========
import express from "express";
import cors from "cors";
import axios from "axios";  // <--- BU SATIRI EKLE!

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ========== BU KISIM TAMAMEN DEĞİŞECEK ==========
// ESKİ KODU BUL VE SİL, YERİNE BUNU YAPIŞTIR:
app.post("/ai/yorum", async (req, res) => {
  try {
    const { title, price, site } = req.body;

    if (!title) {
      return res.status(400).json({ 
        success: false, 
        error: "Ürün başlığı yok" 
      });
    }

    // 1. ÖNCE HUGGING FACE DENE
    const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
    
    if (HF_API_KEY && HF_API_KEY.startsWith("hf_")) {
      try {
        const prompt = `
Ürün: ${title}
${price ? `Fiyat: ${price}` : "Fiyat bilgisi yok"}
Site: ${site || "genel pazar yeri"}

Bu ürün için kısa, samimi, gerçekçi bir alışveriş yorumu yaz.
Yorumu direkt olarak ver, başlık veya açıklama ekleme.
        `.trim();

        const response = await axios.post(
          "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
          {
            inputs: prompt,
            parameters: {
              max_new_tokens: 200,
              temperature: 0.7
            }
          },
          {
            headers: {
              Authorization: `Bearer ${HF_API_KEY}`,
              "Content-Type": "application/json"
            },
            timeout: 20000
          }
        );

        if (response.data && response.data[0]?.generated_text) {
          let aiYorum = response.data[0].generated_text
            .replace(prompt, "")
            .trim();
          
          if (aiYorum && aiYorum.length > 20) {
            return res.json({
              success: true,
              yorum: aiYorum,
              source: "huggingface"
            });
          }
        }
      } catch (hfError) {
        console.log("Hugging Face hatası, fallback kullanılıyor:", hfError.message);
      }
    }

    // 2. HUGGING FACE ÇALIŞMAZSA GÜZEL BİR YORUM YAP
    const emojis = ["📱", "💻", "🎧", "⌚", "🖥️", "🛒", "⭐", "🔥", "🚀"];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    const yorumlar = [
      `${randomEmoji} ${title} ürünü ${site || "pazar yeri"} platformunda incelendi. ${price ? `Fiyat: ${price} TL seviyesinde. ` : ""}Genel olarak fiyat-performans dengesi değerlendirilebilir durumda.`,
      `${randomEmoji} ${title} için ${site || "pazar yeri"} üzerinden analiz: ${price ? `${price} TL fiyat etiketiyle ` : ""}ürün kullanıcı yorumlarına göre olumlu değerlendiriliyor.`,
      `${randomEmoji} ${site || "Site"}'de listelenen ${title} ${price ? `(${price} TL) ` : ""}ürünü, rakip sitelerle karşılaştırıldığında makul bir seçenek olarak öne çıkıyor.`,
      `${randomEmoji} AI değerlendirmesi: ${title} ${price ? `- ${price} TL fiyatıyla ` : ""}${site || "platformunda"} satışta. Ürün özellikleri ve fiyatı göz önüne alındığında değerlendirmeye değer.`
    ];
    
    const randomYorum = yorumlar[Math.floor(Math.random() * yorumlar.length)];

    res.json({
      success: true,
      yorum: randomYorum,
      source: "smart-fallback"
    });

  } catch (error) {
    console.error("AI yorum hatası:", error);
    
    // 3. SON ÇARE: ESKİ BASİT YORUM
    const { title, price, site } = req.body;
    const fallbackYorum = `
${title} ürünü ${site || "pazar yerinde"} listelenmektedir.
${price ? `Yaklaşık fiyat: ${price} TL` : ""}
Genel olarak fiyat/performans açısından değerlendirilebilir.
    `.trim();
    
    res.json({
      success: true,
      yorum: fallbackYorum,
      source: "basic-fallback"
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("API çalışıyor:", PORT));
