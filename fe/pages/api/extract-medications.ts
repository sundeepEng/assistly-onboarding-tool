import { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
// pdf-parse and mammoth are lazy-loaded inside their functions to avoid
// Lambda cold-start failures from pdfjs-dist worker/WASM dynamic requires.

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const EXTRACTION_PROMPT = `You are a medical data extraction assistant specializing in reading Medical Administrator Records (MAR) and medication lists.

Your task has THREE steps:
STEP 1: Scan the FIRST section of the document (e.g., "Times/Day", "Day", "Morning", "AM" section). List every medication and its time from this section.
STEP 2: Scan the SECOND section (e.g., "Times/Nt.", "Night", "Evening", "PM" section) and any additional sections (Afternoon, Bedtime, Insulin, PRN, etc.). List every medication and its time from these sections.
STEP 3: MERGE results — output ONE entry per unique medication name with ALL timings from ALL sections combined into a single timings array.

CRITICAL: Many MARs have TWO tables on the same page — a DAY table and a NIGHT table. You MUST read BOTH tables completely. If "Apixaban - 5 mg" appears with "1(7am)" in the Day table AND "1(7 PM)" in the Night table, the output MUST have timings ["07:00", "19:00"]. Missing a section is the most common error — double-check both tables before outputting.

COMMON MAR FORMATS YOU WILL ENCOUNTER:

FORMAT A — Day/Night sections with "Times/Day" and "Times/Nt.":
  - "Times/Day" or "Day" section typically means 7 AM → "07:00"
  - "Times/Nt." or "Night" section typically means 7 PM → "19:00"
  - If explicit times are shown like "1(7 AM)" or "1(7 PM)", extract those exact times.
  - The same medication may appear in BOTH sections — collect ALL times.
  - Legend "B=Breakfast, L=Lunch, D=Dinner" may appear at the bottom.

FORMAT B — Time-based sections with explicit times in headers:
  - Section headers like "Morning 7:00 am", "Afternoon 12:30", "Evening 7:00 PM", "BedTime (HS)"
  - Use the EXACT time from the section header (e.g., Morning 7:00 am → "07:00", Afternoon 12:30 → "12:30", Evening 7:00 PM → "19:00")
  - Medications under "BedTime (HS)" → "21:00"
  - Medications marked "PRN" or "As NEEDED" → set timings to ["PRN"] and mark directions with "As Needed"

FORMAT C — Insulin with B/L/D shorthand:
  - "B/8 units" means Breakfast → "07:00", 8 units
  - "L/8 units" means Lunch → "12:00", 8 units  
  - "D/8 units" means Dinner → "19:00", 8 units
  - "9PM - 25 units" means "21:00", 25 units
  - Combine all into ONE entry with all timings and describe units per meal in directions.

IMPORTANT RULES:

1. **Collect ALL timings for each medication**: You MUST search EVERY section of the document. If a medication appears in the Day/AM table AND the Night/PM table, its timings array MUST include times from BOTH. For example:
   - "Apixaban - 5 mg" at "1(7am)" in Day table AND "1(7 PM)" in Night table → timings: ["07:00", "19:00"]
   - "Bumetanide - 1 mg" at "1(7 AM)" in Day AND "1(7 PM)" in Night → timings: ["07:00", "19:00"]
   - "Gabapentin 300 mg" under Morning, Afternoon, AND Evening → timings: ["07:00", "12:30", "19:00"]
   NEVER output only the last occurrence — you must include ALL times from ALL sections.

2. **Timings**: ALWAYS return times in 24-hour "HH:mm" format.
   - FIRST, check if the document or section header specifies exact times (e.g., "7 AM", "12:30", "7:00 PM", "9PM"). Convert to 24h: "7 AM" → "07:00", "12:30" → "12:30", "7:00 PM" → "19:00", "9PM" → "21:00".
   - If the document uses meal/time-of-day labels WITHOUT specific times, use these defaults:
     - Breakfast / B / Morning / AM → "07:00"
     - Lunch / L / Noon / NOON / Midday / Afternoon → "12:00"
     - Dinner / D / Evening / Supper / PM → "19:00"
     - Bedtime / Night / HS / BedTime (HS) → "21:00"
   - For frequency-only instructions with NO times at all:
     - QID (4x/day): ["07:00", "12:00", "17:00", "21:00"]
     - TID (3x/day): ["07:00", "12:00", "19:00"]
     - BID (2x/day): ["07:00", "19:00"]
     - QD/daily (1x/day): ["07:00"]
   - For PRN / As Needed medications: set timings to ["PRN"]
   NEVER return meal names as timing values — always convert to "HH:mm" format.

3. **Directions**: Copy the EXACT quantity per dose from the document (e.g., "1/2", "1", "2"). Do NOT round — if the document says "1/2" or "half tab", return "1/2". For insulin or variable-dose meds, describe each meal's dose (e.g., "Breakfast - 8 units, Lunch - 8 units, Dinner - 8 units, Bedtime - 25 units").

4. **Dosage**: Extract the dosage amount with unit exactly as shown (e.g., "1 mg", "25 mcg", "0.4 mg", "300 mg"). If not shown, use "".

5. **Route**: Extract the route if shown (e.g., "Oral", "SubQ", "Topical"). If not shown, use "".

6. **Start/End dates**: Extract if visible. If not shown, use "".

For each medication, return:
- name: The medication name (e.g., "Bumetanide", "Gabapentin", "Insulin Glargine")
- dosage: The dosage with unit (e.g., "1 mg", "300 mg")
- directions: EXACT quantity per dose (e.g., "1", "1/2") or detailed dosing for insulin
- route: Route of administration (e.g., "Oral", "SubQ") or ""
- timings: Array of ALL "HH:mm" time strings collected from the ENTIRE document, or ["PRN"] for as-needed meds
- startDate: Start date in "YYYY-MM-DD" format if shown, otherwise ""
- endDate: End date if shown, otherwise ""

Return a JSON object with a "medications" key containing the array. Do not include any other text.

EXAMPLE 1 — Day/Night MAR with "1(7 AM)" and "1(7 PM)":
{
  "medications": [
    { "name": "Low Dose Aspirin", "dosage": "81 mg", "directions": "1", "route": "", "timings": ["07:00", "19:00"], "startDate": "", "endDate": "" },
    { "name": "Memantine", "dosage": "20 mg", "directions": "1", "route": "", "timings": ["07:00", "19:00"], "startDate": "", "endDate": "" },
    { "name": "Oxybutynin", "dosage": "10 mg", "directions": "1", "route": "", "timings": ["19:00"], "startDate": "", "endDate": "" }
  ]
}

EXAMPLE 2 — Insulin with B/L/D notation:
{
  "medications": [
    { "name": "Insulin Aspart", "dosage": "", "directions": "Breakfast - 8 units, Lunch - 8 units, Dinner - 8 units", "route": "SubQ", "timings": ["07:00", "12:00", "19:00"], "startDate": "", "endDate": "" },
    { "name": "Insulin Glargine", "dosage": "", "directions": "25 units", "route": "SubQ", "timings": ["21:00"], "startDate": "", "endDate": "" }
  ]
}

EXAMPLE 3 — Time-based MAR with section headers:
{
  "medications": [
    { "name": "Gabapentin", "dosage": "300 mg", "directions": "1", "route": "Oral", "timings": ["07:00", "12:30", "19:00"], "startDate": "", "endDate": "" },
    { "name": "Baclofen", "dosage": "10 mg", "directions": "1", "route": "Oral", "timings": ["07:00", "12:30", "19:00"], "startDate": "", "endDate": "" },
    { "name": "Quetiapine", "dosage": "25 mg", "directions": "1/2", "route": "Oral", "timings": ["21:00"], "startDate": "", "endDate": "" },
    { "name": "Oxycodone", "dosage": "10 mg", "directions": "As Needed", "route": "Oral", "timings": ["PRN"], "startDate": "", "endDate": "" }
  ]
}

If no medications are found, return: {"medications": []}`;

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // unpdf is a serverless-friendly PDF text extractor — no DOM globals,
  // no worker files, no native dependencies. Works out of the box in AWS
  // Lambda / Amplify SSR.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fileUrl } = req.body;

  if (!fileUrl) {
    return res.status(400).json({ error: "fileUrl is required" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 25_000, // must stay under Lambda's 30s timeout
    maxRetries: 0,
  });

  try {
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      return res
        .status(400)
        .json({ error: "Failed to fetch the document from storage." });
    }

    const rawContentType = fileResponse.headers.get("content-type") || "";
    let mimeType = rawContentType.split(";")[0].trim();

    if (!mimeType || mimeType === "application/octet-stream") {
      try {
        const urlPath = new URL(fileUrl).pathname.toLowerCase();
        if (urlPath.endsWith(".pdf")) mimeType = "application/pdf";
        else if (urlPath.endsWith(".docx")) mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        else if (urlPath.endsWith(".doc")) mimeType = "application/msword";
        else if (urlPath.endsWith(".jpg") || urlPath.endsWith(".jpeg")) mimeType = "image/jpeg";
        else if (urlPath.endsWith(".png")) mimeType = "image/png";
        else if (urlPath.endsWith(".webp")) mimeType = "image/webp";
      } catch {
        // keep existing mimeType
      }
    }
    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    const model = "gpt-5.6-luna";

    const isImage = mimeType.startsWith("image/");
    const isPDF = mimeType === "application/pdf";
    const isDOCX =
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword";

    if (isImage) {
      const base64 = buffer.toString("base64");
      messages = [
        {
          role: "system",
          content: EXTRACTION_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all medications from this image. Return ONLY a JSON array.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
                detail: "high",
              },
            },
          ],
        },
      ];
    } else if (isPDF) {
      let extractedText = "";
      try {
        extractedText = await extractTextFromPDF(buffer);
      } catch (err) {
        console.error(
          "[extract-medications] PDF text extraction failed, falling back to vision:",
          err instanceof Error ? err.message : err
        );
      }

      if (extractedText.trim()) {
        messages = [
          {
            role: "system",
            content: EXTRACTION_PROMPT,
          },
          {
            role: "user",
            content: `Extract all medications from the following document text:\n\n${extractedText}`,
          },
        ];
      } else {
        // No extractable text layer — the PDF is likely scanned/image-based.
        // Send the raw PDF to the vision-capable model so it can read the
        // page images directly instead of failing outright.
        const base64 = buffer.toString("base64");
        messages = [
          {
            role: "system",
            content: EXTRACTION_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all medications from this document. Return ONLY a JSON object.",
              },
              {
                type: "file",
                file: {
                  filename: "document.pdf",
                  file_data: `data:application/pdf;base64,${base64}`,
                },
              },
            ],
          },
        ];
      }
    } else if (isDOCX) {
      const extractedText = await extractTextFromDOCX(buffer);
      if (!extractedText.trim()) {
        return res
          .status(400)
          .json({ error: "Could not extract text from the document." });
      }
      messages = [
        {
          role: "system",
          content: EXTRACTION_PROMPT,
        },
        {
          role: "user",
          content: `Extract all medications from the following document text:\n\n${extractedText}`,
        },
      ];
    } else {
      return res.status(400).json({
        error:
          "Unsupported file type. Please upload an image (JPG, PNG), PDF, or DOCX file.",
      });
    }

    const completion = await openai.chat.completions.create({
      model,
      messages,
      max_completion_tokens: 4000,
      ...(model === "gpt-5.6-luna" ? { reasoning_effort: "low" as const } : {}),
      response_format: { type: "json_object" },
    });

    const responseText =
      completion.choices[0]?.message?.content?.trim() || "{}";

    let medications: any[];
    try {
      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed)) {
        medications = parsed;
      } else {
        // Find the first array value in the response object
        const arrayValue = Object.values(parsed).find((val) =>
          Array.isArray(val)
        );
        medications = (arrayValue as any[]) || [];
      }
    } catch {
      console.error("Failed to parse GPT response:", responseText);
      return res
        .status(500)
        .json({ error: "Failed to parse medication data from AI response" });
    }

    return res.status(200).json({ medications });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("[extract-medications] FAILED:", detail);
    return res.status(500).json({
      error: `Failed to extract medications: ${detail}`,
    });
  }
}

