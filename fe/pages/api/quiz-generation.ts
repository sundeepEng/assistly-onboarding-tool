import type { NextApiRequest, NextApiResponse } from "next";

import OpenAI from "openai";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
  const { content } = req.body;

  const prompt = `Based on the following training material, generate 10 multiple-choice questions with 4 options each. Clearly mark the correct option.
Content:
${content}

Format:
[
  {
    "question": "What is ...?",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 1
  },
  ...
]
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });
    const rawContent = response.choices[0].message.content!;
    const cleaned = rawContent.replace(/```(?:json)?\s*([\s\S]*?)\s*```/, "$1");

    const quiz = JSON.parse(cleaned);
    res.status(200).json({ quiz });
  } catch (err) {
    console.error("OpenAI Error:", err);
    res.status(500).json({ error: err.message || "Failed to generate quiz." });
  }
}
