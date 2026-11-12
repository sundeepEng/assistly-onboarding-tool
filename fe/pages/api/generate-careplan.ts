import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { carePlanObject, placeholders } = req.body;

  if (!carePlanObject || !placeholders) {
    return res.status(400).json({
      error: "Missing carePlanObject or placeholders",
    });
  }

  try {
    const openaiRes = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `
You are a clinical document formatter.

I will provide:
1. A carePlanObject from my database.
2. A list of placeholders extracted from my DOCX template.

Your job:
- Return ONLY a JSON object in the following exact structure:

{
  "ResidentInformation": {
    "FullName": "",
    "DateOfBirth": "",
    "RoomNumber": "",
    "PrimaryCaregiver": "",
    "EmergencyContact": "",
    "ContactPhone": "",
    "KnownConditions": ""
  },
  "CarePlanAndSupport": {
    "MentalHealth": "",
    "SpeechPatterns": "",
    "EmotionalState": "",
    "MedicationAdherence": "",
    "SocialInteraction": "",
    "PhysicalHealth": "",
    "SafetyMeasures": "",
    "GroomingMeasures": ""
  }
}

Formatting Rules:
- Keys MUST match exactly.
- Use ONLY information from the carePlanObject.
- If data for a placeholder is missing, return an empty string "".
- Never return nested objects.
- Never add or remove fields.
- Never invent clinical information.

IMPORTANT NATURAL-SENTENCE RULE:
For any section where multiple care fields are combined (SafetyMeasures, GroomingMeasures, PhysicalHealth, etc.):
- DO NOT output colon-separated or comma-separated “key: value” pairs.
- Instead produce ONE clean, natural English sentence using the provided data.

Examples:
❌ "Bathing: Full Assistance, Grooming: Monitor & Cue"
✔ "The resident requires full assistance with bathing and monitor-and-cue support for grooming."

❌ "WanderingRisk: true, EvacuationAssistance: false"
✔ "The resident is at risk of wandering and does not require evacuation assistance."

❌ "painManagementCareLevel: No Pain"
✔ "The resident reports no pain."

The output must ALWAYS be valid JSON.
            `,
          },
          {
            role: "user",
            content: JSON.stringify({
              carePlanObject,
              placeholders,
            }),
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = openaiRes.data.choices[0].message.content;

    let parsedJSON = content;
    try {
      parsedJSON = JSON.parse(content);
    } catch {
      parsedJSON = JSON.parse(
        content.replace(/```json|```/g, "").trim()
      );
    }

    return res.status(200).json({ result: parsedJSON });
  } catch (error: any) {
    console.error("Care plan generation error:", error?.response?.data);
    return res.status(500).json({
      error: error?.response?.data || error.message,
    });
  }
}
