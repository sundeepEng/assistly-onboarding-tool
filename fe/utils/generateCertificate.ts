// utils/generateCertificateDocx.ts
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";

/**
 * Fill a .docx template with variables like {{name}} using Docxtemplater.
 * Must be called client-side (browser).
 */
export async function generateCertificateDocx(
  templateUrl: string,
  data: Record<string, any>,
  download?: boolean
) {
  // 1) Fetch template as ArrayBuffer and convert to Uint8Array (safer for PizZip)
  let arrayBuffer: ArrayBuffer;
  try {
    const res = await fetch(templateUrl, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching template`);
    arrayBuffer = await res.arrayBuffer();
    if (!arrayBuffer.byteLength) throw new Error("Template is empty");
  } catch (e) {
    console.error("Failed to download template:", e);
    throw e;
  }

  // 2) Load into PizZip
  let zip: PizZip;
  try {
    zip = new PizZip(new Uint8Array(arrayBuffer));
  } catch (e) {
    console.error(
      "Failed to read template as a ZIP/.docx (is it a valid .docx?):",
      e
    );
    throw e;
  }

  // 3) Init Docxtemplater (nullGetter prevents crashes on missing vars)
  let doc: Docxtemplater;
  try {
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
      delimiters: { start: "[[", end: "]]" },
    });
  } catch (e: any) {
    console.error("Docxtemplater init failed");
    if (e?.properties?.errors) {
      e.properties.errors.forEach((err: any, i: number) => {
        console.error(`#${i + 1}`, {
          id: err?.id,
          explanation: err?.properties?.explanation,
          xtag: err?.properties?.xtag, // tag content if available
          file: err?.properties?.file, // e.g., word/document.xml, header1.xml
          offset: err?.properties?.offset, // character offset
          line: err?.properties?.line,
          col: err?.properties?.col,
        });
      });
    } else {
      console.error(e);
    }
    throw e;
  }

  // 4) Set data and render
  try {
    doc.setData(data);
    doc.render();
  } catch (e: any) {
    // Docxtemplater provides a lot of detail; expose it so you know what's wrong.
    console.error("Template rendering error");
    if (e?.properties?.errors) {
      e.properties.errors.forEach((err: any, i: number) => {
        console.error(`#${i + 1}`, {
          explanation: err?.properties?.explanation,
          id: err?.id,
          message: err?.message,
          context: err?.properties?.id,
        });
      });
    } else {
      console.error(e);
    }
    throw e;
  }

  // 5) Generate the filled document
  const out = doc.getZip().generate({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  // 6) Download

  download &&
    saveAs(
      out,
      `Certificate-${data.Certificate_name + "-" + data.Name || "User"}.docx`
    );
  return out;
}
