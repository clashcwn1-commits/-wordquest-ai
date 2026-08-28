import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, count = 20, type = "words" } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: "Вкажи тему." });
    }

    const amount = Math.max(5, Math.min(Number(count) || 20, 50));

    const instruction = `
Створи навчальні флеш-картки.

Поверни тільки JSON у такому форматі:
{
  "title": "Назва набору",
  "cards": [
    {"q": "слово або питання", "a": "переклад або відповідь"}
  ]
}

Кількість карток: ${amount}
Тип карток: ${type}

Не повторюй картки.
Не додавай нумерацію.
Використовуй мову та напрям перекладу, які попросив користувач.

Запит користувача:
${prompt}
`;

    const response = await client.responses.create({
      model: "gpt-5.6-luna",
      input: instruction
    });

    let text = response.output_text.trim();

    text = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");

    const data = JSON.parse(text);

    return res.status(200).json(data);

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Не вдалося створити картки."
    });
  }
}
