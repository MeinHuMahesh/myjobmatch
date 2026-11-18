export interface JobDescriptionListItem {
  marker: string | null;
  text: string;
}

export type JobDescriptionBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: JobDescriptionListItem[] };

export interface ParsedJobDescription {
  institution: string | null;
  advertisementNo: string | null;
  blocks: JobDescriptionBlock[];
}

const SUMMARY_FIELDS = new Set(
  [
    "Job Title",
    "Job Reference Number",
    "Application End Date",
    "Type of Employment",
    "No. of Position(s)",
  ].map((field) => normalizeKey(field)),
);

const KNOWN_HEADINGS: RegExp[] = [
  /^IITB (?:project )?recruit/i,
  /^Essential qualifications?/i,
  /^Essential$/i,
  /^Desirable$/i,
  /^Job profile/i,
  /^Pay details/i,
  /^General information/i,
  /^How to apply/i,
  /^Terms and conditions/i,
  /^Selection process/i,
  /^Additional information/i,
  /^Note$/i,
];

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanup(line: string): string {
  return line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function isPageMarker(line: string): boolean {
  return /^--\s*\d+\s+of\s+\d+\s*--$/i.test(line);
}

function headingBody(line: string): string {
  return cleanup(line)
    .replace(/^(?:\(?[ivxIVX]+\)|[A-Z]\))\s+/, "")
    .replace(/\s*[-–]\s*$/, "")
    .replace(/\s*:\s*$/, "")
    .trim();
}

function isHeading(line: string): boolean {
  const trimmed = cleanup(line);
  if (!trimmed || trimmed.length > 110 || isPageMarker(trimmed)) return false;

  const body = headingBody(trimmed);
  if (!body) return false;

  const colonIndex = body.indexOf(":");
  const hasTextAfterColon =
    colonIndex >= 0 && body.slice(colonIndex + 1).trim().length > 0;
  if (hasTextAfterColon) return false;

  if (KNOWN_HEADINGS.some((pattern) => pattern.test(body))) return true;

  if (/^(?:[•·▪◦*]|--|[-–])(?:\s|$)/.test(trimmed)) return false;
  if (/^(?:\(?[a-zA-Z]\)|[a-zA-Z]\.|\(?[ivxIVX]+\)|\d+[.)])(?:\s|$)/.test(trimmed)) {
    return false;
  }

  return body.endsWith(":") && body.length <= 80;
}

function parseBullet(
  line: string,
): { ordered: boolean; marker: string | null; text: string } | null {
  const bullet = line.match(/^(?:[•·▪◦*]|--|[-–])\s+(.*)$/);
  if (bullet) return { ordered: false, marker: null, text: bullet[1].trim() };

  const enumerated = line.match(
    /^(\(?[a-zA-Z]\)|[a-zA-Z]\.|\(?[ivxIVX]+\)|\d+[.)])\s*(.*)$/,
  );
  if (enumerated) {
    return {
      ordered: true,
      marker: enumerated[1],
      text: enumerated[2].trim(),
    };
  }

  if (/^(?:Optional|Desirable|Essential)\s*(?:--|–|-)\s+\S/i.test(line)) {
    return { ordered: false, marker: null, text: line };
  }

  return null;
}

function isFactLine(text: string): boolean {
  return /^(Project title|About the project|Pay Level|Consolidated salary|Age limit|Salary|Stipend|Tenure|Duration)\b/i.test(
    text,
  );
}

function shouldAppendToListItem(lastText: string, nextLine: string): boolean {
  const trimmed = lastText.trim();
  if (!trimmed) return true;
  if (/(?:https?:\/\/|mailto:)\S+$/i.test(trimmed)) return false;
  if (/[.!?]$/.test(trimmed)) return false;
  return !/^[A-Z][a-z]/.test(nextLine) || !/[.!?)]$/.test(trimmed);
}

export function parseJobDescription(raw: string): ParsedJobDescription {
  const source = raw.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  const cleaned: string[] = [];
  let institution: string | null = null;
  let advertisementNo: string | null = null;
  let skipNext = false;

  for (const rawLine of source.split("\n")) {
    const line = cleanup(rawLine);
    if (!line) {
      cleaned.push("");
      continue;
    }
    if (isPageMarker(line)) continue;
    if (/^INDIAN INSTITUTE OF TECHNOLOGY BOMBAY$/i.test(line)) {
      institution = "Indian Institute of Technology Bombay";
      continue;
    }
    if (/^POWAI,\s*MUMBAI\s*400076\.?$/i.test(line)) continue;

    const advert = line.match(/^Advertisement\s+No\.?\s*[:\-–]?\s*(.+)$/i);
    if (advert) {
      advertisementNo = advert[1].trim();
      continue;
    }

    const inlineSummary = line.match(
      /^(Job Title|Job Reference Number|Application End Date|Type of Employment|No\. of Position\(s\))\s*[:\-–]\s*(.+)$/i,
    );
    if (inlineSummary) continue;

    const key = normalizeKey(line);
    if (SUMMARY_FIELDS.has(key)) {
      skipNext = true;
      continue;
    }
    if (skipNext) {
      skipNext = false;
      continue;
    }

    cleaned.push(line);
  }

  const blocks: JobDescriptionBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: JobDescriptionListItem[] } | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    blocks.push({
      kind: "paragraph",
      text: paragraph.join(" ").replace(/\s+/g, " ").trim(),
    });
    paragraph = [];
  };

  const flushList = (): void => {
    if (!list) return;
    const items = list.items.filter(
      (item) => item.text.trim().length > 0 || item.marker,
    );
    if (items.length > 0) {
      blocks.push({ kind: "list", ordered: list.ordered, items });
    }
    list = null;
  };

  const flush = (): void => {
    flushParagraph();
    flushList();
  };

  for (const line of cleaned) {
    if (!line) {
      flush();
      continue;
    }

    if (isHeading(line)) {
      flush();
      blocks.push({ kind: "heading", text: headingBody(line) });
      continue;
    }

    const bullet = parseBullet(line);
    if (bullet) {
      flushParagraph();
      if (!list || list.ordered !== bullet.ordered) {
        flushList();
        list = { ordered: bullet.ordered, items: [] };
      }
      list.items.push({ marker: bullet.marker, text: bullet.text });
      continue;
    }

    if (list) {
      const last = list.items[list.items.length - 1];
      if (last && shouldAppendToListItem(last.text, line)) {
        last.text = `${last.text} ${line}`.replace(/\s+/g, " ").trim();
        continue;
      }
      flushList();
    }

    if (isFactLine(line)) {
      flushParagraph();
      paragraph.push(line);
      continue;
    }

    if (paragraph.length > 0 && isFactLine(paragraph[0]) && /^[A-Z]/.test(line)) {
      flushParagraph();
    }

    paragraph.push(line);
  }

  flush();

  return { institution, advertisementNo, blocks };
}
