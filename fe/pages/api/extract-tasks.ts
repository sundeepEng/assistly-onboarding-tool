import { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "10mb",
        },
    },
};

const EXTRACTION_PROMPT = `You are a household task extraction assistant. Extract tasks from the provided document.

IMPORTANT: If the document contains a section heading related to housekeeping (e.g., "Housekeeping", "House Tasks", "House Chores", or similar variations), extract ONLY the tasks listed under that section and ignore all other sections. If no such heading exists, extract all tasks from the document.

For each task, return:
- name: the task name
- category: one of [Cleaning, Kitchen, Laundry, Medication, Inventory, Security, Outdoor, Other]
- shift: one of [Morning, Afternoon, Evening]. If a task does NOT have an explicit time or shift, use "Morning".
- days: optional array of day abbreviations (Mon, Tue, Wed, Thu, Fri, Sat, Sun). Only include if the document explicitly lists days.

Return ONLY a JSON object with a "tasks" key containing the array, for example:
{
  "tasks": [
    { "name": "Sweep Living Room", "category": "Cleaning", "shift": "Morning", "days": ["Mon", "Tue", "Wed"] }
  ]
}

If no tasks are found, return: {"tasks": []}`;

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
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

function getMimeType(fileName: string, provided?: string): string {
    if (provided && provided !== "application/octet-stream") {
        return provided;
    }
    const lower = (fileName || "").toLowerCase();
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (lower.endsWith(".doc")) return "application/msword";
    if (lower.endsWith(".csv")) return "text/csv";
    if (lower.endsWith(".txt")) return "text/plain";
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".svg")) return "image/svg+xml";
    if (lower.endsWith(".bmp")) return "image/bmp";
    if (lower.endsWith(".tiff") || lower.endsWith(".tif")) return "image/tiff";
    return provided || "application/octet-stream";
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { fileData, fileName, mimeType } = req.body;

    if (!fileData || !fileName) {
        return res.status(400).json({ error: "fileData and fileName are required" });
    }

    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "Server configuration error" });
    }

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 25_000,
        maxRetries: 0,
    });

    try {
        const buffer = Buffer.from(fileData, "base64");
        const detectedMime = getMimeType(fileName, mimeType);

        const isImage = detectedMime.startsWith("image/");
        const isPDF = detectedMime === "application/pdf";
        const isDOCX =
            detectedMime ===
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            detectedMime === "application/msword";
        const isText =
            detectedMime === "text/plain" ||
            detectedMime === "text/csv" ||
            detectedMime.startsWith("text/");

        let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
        const model = "gpt-5.6-luna";

        if (isImage) {
            const base64 = buffer.toString("base64");
            messages = [
                { role: "system", content: EXTRACTION_PROMPT },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Extract all tasks from this image. Return ONLY a JSON object." },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${detectedMime};base64,${base64}`,
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
                console.error("[extract-tasks] PDF text extraction failed, falling back to vision:", err);
            }

            if (extractedText.trim()) {
                messages = [
                    { role: "system", content: EXTRACTION_PROMPT },
                    { role: "user", content: `Extract all tasks from the following document text:\n\n${extractedText}` },
                ];
            } else {
                const base64 = buffer.toString("base64");
                messages = [
                    { role: "system", content: EXTRACTION_PROMPT },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Extract all tasks from this document. Return ONLY a JSON object." },
                            {
                                type: "file",
                                file: {
                                    filename: fileName,
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
                return res.status(400).json({ error: "Could not extract text from the document." });
            }
            messages = [
                { role: "system", content: EXTRACTION_PROMPT },
                { role: "user", content: `Extract all tasks from the following document text:\n\n${extractedText}` },
            ];
        } else if (isText) {
            const extractedText = buffer.toString("utf-8");
            messages = [
                { role: "system", content: EXTRACTION_PROMPT },
                { role: "user", content: `Extract all tasks from the following text:\n\n${extractedText}` },
            ];
        } else {
            return res.status(400).json({
                error: "Unsupported file type. Please upload PDF, DOCX, CSV, TXT, or an image.",
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

        let tasks: any[] = [];
        try {
            const parsed = JSON.parse(responseText);
            if (Array.isArray(parsed)) {
                tasks = parsed;
            } else if (Array.isArray(parsed?.tasks)) {
                tasks = parsed.tasks;
            } else {
                const arrayValue = Object.values(parsed).find((val) =>
                    Array.isArray(val)
                );
                tasks = (arrayValue as any[]) || [];
            }
        } catch {
            console.error("Failed to parse GPT response:", responseText);
            return res
                .status(500)
                .json({ error: "Failed to parse task data from AI response" });
        }

        return res.status(200).json({ tasks });
    } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown error";
        console.error("[extract-tasks] FAILED:", detail);
        return res.status(500).json({
            error: `Failed to extract tasks: ${detail}`,
        });
    }
}
