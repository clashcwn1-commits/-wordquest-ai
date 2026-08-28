import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      prompt,
      count = 20,
      type = "words"
    } = req.body || {};

    if (!prompt) {
      return res.status(400).json({
        error: "Вкажи тему для карток."
      });
    }

    const amount = Math.max(
      5,
      Math.min(Number(count) || 20, 50)
    );

    const instructions = `
Ти створюєш навчальні флеш-картки.

Користувач просить:
${prompt}

Кількість карток: ${amount}
Тип: ${type}

Поверни ТІЛЬКИ валідний JSON без markdown і без пояснень.

Формат:
{
  "title": "Коротка назва набору",
  "cards": [
    {
      "q": "слово, фраза або питання",
      "a": "переклад або відповідь"
    }
  ]
}

Правила:
- створи рівно ${amount} карток;
- не дублюй картки;
- використовуй мови, які просить користувач;
- не додавай нумерацію;
- q і a мають бути короткими та зрозумілими.
`;

    const response = await client.responses.create({
      model: "gpt-5.6-luna",
      input: instructions
    });

    let text = response.output_text?.trim();

    if (!text) {
      throw new Error("AI повернув порожню відповідь");
    }

    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");

    const data = JSON.parse(text);

    if (!data || !Array.isArray(data.cards)) {
      throw new Error("Неправильний формат відповіді AI");
    }

    const cards = data.cards
      .filter(card =>
        card &&
        typeof card.q === "string" &&
        typeof card.a === "string"
      )
      .slice(0, amount);

    return res.status(200).json({
      title: data.title || "AI набір",
      cards
    });

  } catch (error) {
    console.error("AI generation error:", error);

    return res.status(500).json({
      error: error?.message || "Не вдалося створити картки."
    });
  }
}
