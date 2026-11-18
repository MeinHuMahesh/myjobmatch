const PAGE_MARKER = /^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gim;

export function normalizeExtractedText(input: string): string {
  let text = input
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(PAGE_MARKER, "\n");

  text = text.replace(/([A-Za-z])-\n(?=[a-z])/g, "$1");
  text = text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

export function countReadableChars(text: string): number {
  return text.replace(/\s+/g, "").length;
}

export function pageNeedsOcr(text: string, minChars: number): boolean {
  return countReadableChars(text) < minChars;
}
