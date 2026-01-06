app.post("/ai/yorum", async (req, res) => {
  try {
    const { originalQuery } = req.body;

    if (!originalQuery) {
      return res.json({
        success: true,
        yorum: "🤖 Ürün adı bulunamadı."
      });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.json({
        success: true,
        yorum: "🤖 Groq API anahtarı tanımlı değil."
      });
    }

    // 🔥 İŞTE SENİN SORDUĞUN KOD TAM BURAYA
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-anlik",
        messages: [
          {
            role: "system",
            content: "You are a helpful shopping assistant."
          },
          {
            role: "user",
            content: `Ürün hakkında kısa ve kullanıcı dostu bir alışveriş yorumu yaz: ${originalQuery}`
          }
        ],
        temperature: 0.7,
        max_tokens: 180
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );
    // 🔥 KOD BURAYA KADAR

    const aiText = response.data?.choices?.[0]?.message?.content?.trim();

    if (aiText) {
      return res.json({
        success: true,
        yorum: aiText
      });
    }

    return res.json({
      success: true,
      yorum: "🤖 Ürün değerlendirilebilir ancak detay üretilemedi."
    });

  } catch (error) {
    console.error("GROQ ERROR:", error.response?.data || error.message);
    return res.json({
      success: true,
      yorum: "🤖 AI servisi şu anda cevap veremiyor."
    });
  }
});
