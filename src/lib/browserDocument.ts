import { parseResume } from "./resumeText";
import type { ResumeProfile } from "./types";

export async function extractBrowserDocument(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_PAGES_BASE_PATH ?? ""}/pdf.worker.min.mjs`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const document = await pdfjs.getDocument({ data: bytes }).promise;
    const pages: string[] = [];
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(
          content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" "),
        );
      }
    } finally {
      await document.destroy();
    }
    return pages.join("\n");
  }

  if (name.endsWith(".docx")) {
    const { default: mammoth } = await import("mammoth/mammoth.browser.js");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value;
  }

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return file.text();
  }

  throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
}

export async function parseBrowserResume(file: File): Promise<ResumeProfile> {
  const text = await extractBrowserDocument(file);
  if (!text.trim()) {
    throw new Error("Could not extract any text from the uploaded file. Is it a scanned PDF?");
  }
  return parseResume(text, file.name);
}
