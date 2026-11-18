import fs from "node:fs";
import { createWorker, type Worker } from "tesseract.js";
import engData from "@tesseract.js-data/eng";
import { PDFParse } from "pdf-parse";
import { config } from "./config";
import {
  countReadableChars,
  normalizeExtractedText,
  pageNeedsOcr,
} from "./textNormalize";
import type { JdSource } from "./types";

export interface PdfTextResult {
  text: string;
  source: JdSource;
  pages: number;
  ocrPages: number[];
  charCount: number;
}

export interface ExtractTextOptions {
  ocr?: boolean;
}

let workerPromise: Promise<Worker> | null = null;
let ocrQueue: Promise<unknown> = Promise.resolve();

async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    fs.mkdirSync(config.ocrCacheDir, { recursive: true });
    workerPromise = createWorker(config.ocrLang, 1, {
      langPath: engData.langPath,
      gzip: engData.gzip,
      cachePath: config.ocrCacheDir,
    }).catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

async function recognizeImage(image: Buffer): Promise<string> {
  const worker = await getOcrWorker();
  const run = ocrQueue.then(() => worker.recognize(image));
  ocrQueue = run.then(
    () => undefined,
    () => undefined,
  );
  const result = await run;
  return result.data.text;
}

async function ocrPages(
  parser: PDFParse,
  pageNumbers: number[],
  pageTexts: Map<number, string>,
): Promise<void> {
  if (pageNumbers.length === 0) return;

  const screenshots = await parser.getScreenshot({
    partial: pageNumbers,
    scale: config.ocrScale,
    imageDataUrl: false,
    imageBuffer: true,
  });
  const images = new Map(
    screenshots.pages.map((page) => [page.pageNumber, page.data]),
  );

  for (const pageNumber of pageNumbers) {
    const image = images.get(pageNumber);
    if (!image) continue;
    pageTexts.set(pageNumber, await recognizeImage(Buffer.from(image)));
  }
}

export async function extractPdfText(
  data: Uint8Array,
  options: ExtractTextOptions = {},
): Promise<PdfTextResult> {
  const parser = new PDFParse({ data: new Uint8Array(data) });
  const useOcr = options.ocr ?? false;

  try {
    let pageTexts = new Map<number, string>();
    let total = 0;
    let lowQualityPages: number[] = [];
    let extracted = false;

    try {
      const parsed = await parser.getText({
        lineEnforce: true,
        lineThreshold: 6,
        cellSeparator: " ",
        pageJoiner: "",
        parseHyperlinks: false,
      });
      total = parsed.total;
      pageTexts = new Map(parsed.pages.map((page) => [page.num, page.text]));
      lowQualityPages = parsed.pages
        .filter((page) =>
          pageNeedsOcr(page.text, config.ocrMinCharsPerPage),
        )
        .map((page) => page.num);
      extracted = true;
    } catch (error) {
      if (!useOcr) throw error;
    }

    if (!useOcr) {
      const text = normalizeExtractedText(
        Array.from({ length: total }, (_, index) =>
          pageTexts.get(index + 1) ?? "",
        ).join("\n"),
      );
      return {
        text,
        source: "native",
        pages: total,
        ocrPages: [],
        charCount: countReadableChars(text),
      };
    }

    if (!extracted) {
      const screenshots = await parser.getScreenshot({
        scale: config.ocrScale,
        imageDataUrl: false,
        imageBuffer: true,
      });
      total = screenshots.total;
      pageTexts = new Map();
      lowQualityPages = screenshots.pages.map((page) => page.pageNumber);
      const images = new Map(
        screenshots.pages.map((page) => [page.pageNumber, page.data]),
      );
      for (const pageNumber of lowQualityPages) {
        const image = images.get(pageNumber);
        if (!image) continue;
        pageTexts.set(
          pageNumber,
          await recognizeImage(Buffer.from(image)),
        );
      }
    } else {
      await ocrPages(parser, lowQualityPages, pageTexts);
    }

    const text = normalizeExtractedText(
      Array.from({ length: total }, (_, index) =>
        pageTexts.get(index + 1) ?? "",
      ).join("\n"),
    );
    const source: JdSource =
      lowQualityPages.length === 0
        ? "native"
        : lowQualityPages.length >= total
          ? "ocr"
          : "mixed";

    return {
      text,
      source,
      pages: total,
      ocrPages: lowQualityPages,
      charCount: countReadableChars(text),
    };
  } finally {
    await parser.destroy();
  }
}
