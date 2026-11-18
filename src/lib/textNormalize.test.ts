import { describe, expect, it } from "vitest";
import {
  countReadableChars,
  normalizeExtractedText,
  pageNeedsOcr,
} from "./textNormalize";

describe("normalizeExtractedText", () => {
  it("removes page markers and joins line-break hyphenation", () => {
    const text = normalizeExtractedText(
      "Applicant should have knowl-\nedge of Java.\n-- 1 of 2 --\n\n\nSecond page",
    );
    expect(text).toBe("Applicant should have knowledge of Java.\n\nSecond page");
  });

  it("normalises quotes, dashes, non-breaking spaces, and repeated spaces", () => {
    const text = normalizeExtractedText(
      "Project\u00a0title:\u00a0\u201cSmart\u201d  campus\u2014phase\u20131\r\n",
    );
    expect(text).toBe('Project title: "Smart" campus-phase-1');
  });

  it("trims trailing whitespace on each line", () => {
    expect(normalizeExtractedText("one   \ntwo\t\n")).toBe("one\ntwo");
  });
});

describe("OCR quality checks", () => {
  it("counts readable characters without whitespace", () => {
    expect(countReadableChars(" A B\n C ")).toBe(3);
  });

  it("flags pages below the minimum character threshold", () => {
    expect(pageNeedsOcr("short", 40)).toBe(true);
    expect(pageNeedsOcr("word ".repeat(20), 40)).toBe(false);
  });
});
