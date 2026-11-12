import { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const SMS_MAX_CHARS = 319;

const cleanSmsDraft = (text: string) => {
  return text
    .replace(/^subject\s*:.*$/gim, "")
    .replace(/^(hi|hello|dear)\b[:,]?\s*/i, "")
    .replace(/\b(regards|best regards|thanks|thank you),?\s*.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
};

const limitToStrictSmsLength = (text: string) => {
  const cleaned = cleanSmsDraft(text);

  if (cleaned.length <= SMS_MAX_CHARS) {
    return cleaned;
  }

  return cleaned.slice(0, SMS_MAX_CHARS).trimEnd();
};

const cleanEmailDraft = (text: string) => {
  return text
    .replace(/I hope this (message|email) finds you well[.,]?\s*/gi, "")
    .replace(/I hope you are doing well[.,]?\s*/gi, "")
    .replace(/\s+$/g, "")
    .trim();
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!req.body.campaignType || !req.body.tone) {
    return res
      .status(400)
      .json({ error: "campaignType and tone are required" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const {
      campaignType,
      tone,
      eventContext = "",
      keyDetails = "",
      callToAction = "",
      channel = "",
    } = req.body;

    const isMessageType = String(channel).toLowerCase() === "sms";

    const prompt = isMessageType
      ? `Create a short ${tone} SMS campaign message.

Rules:
- The final message must be strictly less than 320 characters.
- Do not include a subject line.
- Do not include greetings like "Dear", "Hi", "Hello", or "Hi team".
- Do not include regards, signature, sender name, or closing.
- Do not format it like an email.
- Keep it clear, direct, friendly, and action-oriented.
- Return only the final SMS text.

Details:
${eventContext ? `Event/Context: ${eventContext}` : ""}
${keyDetails ? `Key Details: ${keyDetails}` : ""}
${callToAction ? `Call to Action: ${callToAction}` : ""}`
      : `Write a short, natural ${tone} ${campaignType} email the way a real person would send it.

Rules:
- Keep the email between 50 and 100 words.
- Include a simple subject line.
- The subject line must be 5-8 words and directly convey the context.
- Use ONLY the details provided below. Do not invent or assume any facts, names, dates, locations, events, or context.
- Do not repeat or rehash the details; state each point once, briefly.
- Do not add generic filler, background, or promotional language.
- Avoid robotic, overly polished, or corporate-sounding phrasing.
- Avoid phrases like "I hope this message finds you well" or "We are pleased to inform you."
- Use short, scannable paragraphs and plain, human language.
- Include exactly one clear call to action and a simple sign-off.
- Return only the final email draft.

Details:
${eventContext ? `Event/Context: ${eventContext}` : ""}
${keyDetails ? `Key Details: ${keyDetails}` : ""}
${callToAction ? `Call to Action: ${callToAction}` : ""}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: isMessageType
            ? "You are a professional SMS marketing copywriter. Generate SMS text only. Never include subject lines, greetings, sign-offs, regards, or sender names. The final response must be strictly less than 320 characters."
            : "You are a healthcare outreach writer who drafts campaign emails that sound natural and human. Write concise, conversational emails using only the details the user provides. Do not add extra context, repeat information, or use inflated or generic marketing language. Keep the output short, plain, and directly tied to the supplied details.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: isMessageType ? 90 : 500,
    });

    let draft = completion.choices[0]?.message?.content?.trim() || "";

    if (!draft) {
      return res.status(500).json({ error: "No content generated" });
    }

    if (isMessageType) {
      draft = limitToStrictSmsLength(draft);
    } else {
      draft = cleanEmailDraft(draft);
    }

    return res.status(200).json({
      draft,
      characterCount: draft.length,
    });
  } catch (error) {
    console.error("Error in generate-campaign-draft:", error);

    return res.status(500).json({
      error: "Failed to generate campaign draft",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
