export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { prompt, count = 20, type = "words" } = req.body || {};

    if (!prompt) {
      return res.status(400).json({
        error: "Вкажи тему для карток."
      });
    }

    const amount = Math.max(5, Math.min(Number(count) || 20, 50));

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY не налаштований у Vercel."
      });
    }

    const instruction = `
Створи навчальні флеш-картки.

Запит користувача:
${prompt}

Кількість: ${amount}
Тип: ${type}

Поверни ТІЛЬКИ валідний JSON без markdown:

{
  "title": "Коротка назва набору",
  "cards": [
    {
      "q": "слово або питання",
      "a": "переклад або відповідь"
    }
  ]
}

Правила:
- рівно ${amount} карток;
- без дублів;
- без нумерації;
- використовуй мови, які просить користувач.
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        input: instruction
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", data);

      return res.status(response.status).json({
        error: data?.error?.message || "Помилка OpenAI API."
      });
    }

    let text = "";

    if (typeof data.output_text === "string") {
      text = data.output_text;
    } else if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (!Array.isArray(item.content)) continue;

        for (const part of item.content) {
          if (part.type === "output_text" && typeof part.text === "string") {
            text += part.text;
          }
        }
      }
    }

    text = text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");

    if (!text) {
      return res.status(500).json({
        error: "AI повернув порожню відповідь."
      });
    }

    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed.cards)) {
      return res.status(500).json({
        error: "AI повернув неправильний формат."
      });
    }

    return res.status(200).json({
      title: parsed.title || "AI набір",
      cards: parsed.cards.slice(0, amount)
    });

  } catch (error) {
    console.error("generate.js crash:", error);

    return res.status(500).json({
      error: error?.message || "Server error."
    });
  }
}
