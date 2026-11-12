import { documentRequiredForSenior } from "./constants";
import _ from "lodash";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export function isDocumentRequired(
  filename: string,
  documets = documentRequiredForSenior
): boolean | null {
  // Strip extension if any
  const baseName = filename.split(".")[0];

  const doc = _.find(documets, { name: baseName });
  return doc ? doc.required : null; // null if not found
}

import { format } from "date-fns";

/**
 * Downloads PDF bytes as a file with a dynamic name.
 * @param pdfBytes - The Uint8Array or ArrayBuffer returned from pdf-lib.
 * @param prefix - File name prefix (e.g., "daily_schedule" or "monthly_report").
 * @param date - Optional date used in the file name.
 */
export const downloadPdf = (
  pdfBytes: Uint8Array | ArrayBuffer,
  prefix: string,
  date?: Date
) => {
  const fileName = date
    ? `${prefix}_${format(date, "yyyy_MM_dd")}.pdf`
    : `${prefix}.pdf`;

  let arrayBuffer: ArrayBuffer;

  if (pdfBytes instanceof Uint8Array) {
    // Slice to get just this view’s bytes
    arrayBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength
    ) as ArrayBuffer;
  } else {
    arrayBuffer = pdfBytes as ArrayBuffer;
  }

  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();

  URL.revokeObjectURL(url);
};

async function fetchDocTemplate(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch template");
  return res.arrayBuffer();
}

/**
 * Reusable DOCX generator for any doc template
 *
 * @param docUrl - S3 link to template
 * @param data - Key-value pairs replacing placeholders
 */
export async function generateFilledDocx(
  docUrl: string,
  data: Record<string, any>
) {
  try {
    const templateBuffer = await fetchDocTemplate(docUrl);

    const zip = new PizZip(templateBuffer);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // 1. Prepare data → empty string if missing or blank
    const preparedData: Record<string, string> = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        value && typeof value === "string" && value.trim() !== "" ? value : "",
      ])
    );

    // 2. Inject into template
    doc.setData(preparedData);

    try {
      doc.render();
    } catch (error: any) {
      console.error("DOCX render error:", error);
      throw error;
    }

    // 3. Generate final DOCX
    return doc.getZip().generate({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  } catch (error) {
    console.error("Error generating DOCX:", error);
    throw error;
  }
}
