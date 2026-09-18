/**
 * Client-side text extraction for resumes and policy documents.
 *
 * The browser has the file, so extraction happens here rather than uploading a
 * binary for a server parse. Callers must treat a short result as a failure and
 * fall back to the manual text field rather than sending blank text to the model.
 */

export const MIN_USEFUL_TEXT = 50;

export interface ExtractionResult {
  text: string;
  ok: boolean;
  reason?: string;
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push(text);
  }

  await doc.destroy();
  return pages.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
  const name = file.name.toLowerCase();

  try {
    let text = "";

    if (name.endsWith(".pdf") || file.type === "application/pdf") {
      text = await extractPdf(file);
    } else if (name.endsWith(".docx")) {
      text = await extractDocx(file);
    } else if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
      text = await file.text();
    } else {
      return {
        text: "",
        ok: false,
        reason: "Unsupported file type. Upload a PDF, DOCX, TXT or Markdown file.",
      };
    }

    // Strip NUL bytes without a control-character regex literal.
    const cleaned = text.split(String.fromCharCode(0)).join("").trim();

    if (cleaned.length < MIN_USEFUL_TEXT) {
      return {
        text: cleaned,
        ok: false,
        reason:
          cleaned.length === 0
            ? "No text layer found. This is likely a scanned document, so the text could not be read."
            : "Very little text was found. The document may be image-based or nearly empty.",
      };
    }

    return { text: cleaned, ok: true };
  } catch (error) {
    return {
      text: "",
      ok: false,
      reason: error instanceof Error ? error.message : "The file could not be read.",
    };
  }
}

/** Split long text into overlapping chunks suitable for ranked retrieval. */
export function chunkText(text: string, size = 900, overlap = 120): string[] {
  const normalised = text.replace(/\s+/g, " ").trim();
  if (!normalised) return [];
  if (normalised.length <= size) return [normalised];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalised.length) {
    const end = Math.min(start + size, normalised.length);
    chunks.push(normalised.slice(start, end));
    if (end === normalised.length) break;
    start = end - overlap;
  }
  return chunks;
}
