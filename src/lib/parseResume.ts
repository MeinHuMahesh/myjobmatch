import mammoth from "mammoth";
import { extractPdfText, type ExtractTextOptions, type PdfTextResult } from "./pdfText";
import { parseResume } from "./resumeText";
import { countReadableChars } from "./textNormalize";

export { parseResume } from "./resumeText";

export async function extractDocument(
  fileName: string,
  data: Buffer,
  options: ExtractTextOptions = {},
): Promise<PdfTextResult> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return extractPdfText(new Uint8Array(data), options);
  }

  let text: string;
  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: data });
    text = result.value;
  } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    text = data.toString("utf8");
  } else {
    throw new Error("Unsupported file type. Please upload a PDF or DOCX file.");
  }

  return {
    text,
    source: "native",
    pages: 0,
    ocrPages: [],
    charCount: countReadableChars(text),
  };
}

export async function extractDocumentText(
  fileName: string,
  data: Buffer,
): Promise<string> {
  return (await extractDocument(fileName, data)).text;
}

export async function parseResumeFile(fileName: string, data: Buffer) {
  const text = await extractDocumentText(fileName, data);
  if (!text.trim()) {
    throw new Error("Could not extract any text from the uploaded file. Is it a scanned PDF?");
  }
  return parseResume(text, fileName);
}
