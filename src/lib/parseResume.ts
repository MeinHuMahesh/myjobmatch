import mammoth from "mammoth";
import {
  detectBranches,
  detectDegrees,
  extractCgpa,
  extractGraduationYears,
} from "./extract";
import {
  extractPdfText,
  type ExtractTextOptions,
  type PdfTextResult,
} from "./pdfText";
import { extractSkillsFromText, normalizeSkillList } from "./skills";
import { countReadableChars } from "./textNormalize";
import type { EducationEntry, ResumeProfile } from "./types";

const ROLE_PATTERNS: { title: string; pattern: RegExp }[] = [
  { title: "Software Engineer", pattern: /software\s+(?:engineer|developer|development)/i },
  { title: "Backend Engineer", pattern: /back[\s-]?end/i },
  { title: "Frontend Engineer", pattern: /front[\s-]?end/i },
  { title: "Full Stack Developer", pattern: /full[\s-]?stack/i },
  { title: "Data Scientist", pattern: /data\s+scien/i },
  { title: "Data Analyst", pattern: /data\s+analy/i },
  { title: "Machine Learning Engineer", pattern: /machine\s+learning|\bml\s+engineer\b/i },
  { title: "DevOps Engineer", pattern: /devops|site\s+reliability|\bsre\b/i },
  { title: "Product Manager", pattern: /product\s+manage/i },
  { title: "Mobile Developer", pattern: /android|ios\s+developer|mobile\s+develop/i },
  { title: "Business Analyst", pattern: /business\s+analy/i },
  { title: "Research Engineer", pattern: /research\s+(?:engineer|scientist|intern)/i },
  { title: "Embedded Engineer", pattern: /embedded|vlsi|fpga/i },
  { title: "Mechanical Design Engineer", pattern: /solidworks|autocad|catia|mechanical\s+design/i },
  { title: "Consultant", pattern: /consult/i },
];

const SECTION_HEADINGS = [
  "education",
  "experience",
  "work experience",
  "professional experience",
  "internships",
  "projects",
  "academic projects",
  "skills",
  "technical skills",
  "certifications",
  "certificates",
  "achievements",
  "awards",
  "publications",
  "positions of responsibility",
  "extracurricular",
  "summary",
  "objective",
  "profile",
];

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 60) return false;
  if (trimmed.endsWith(":")) return true;
  const lower = trimmed.toLowerCase().replace(/[^a-z ]/g, "").trim();
  if (SECTION_HEADINGS.includes(lower)) return true;
  return /^[A-Z][A-Z\s&/]{3,}$/.test(trimmed);
}

function extractSection(lines: string[], headingRegex: RegExp): string[] {
  const index = lines.findIndex(
    (line) => headingRegex.test(line.trim()) && line.trim().length < 60,
  );
  if (index === -1) return [];
  const collected: string[] = [];
  for (let i = index + 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      if (collected.length > 0) break;
      continue;
    }
    if (isHeading(trimmed) && collected.length > 0) break;
    collected.push(trimmed);
    if (collected.length >= 40) break;
  }
  return collected;
}

function extractName(text: string, lines: string[]): string | null {
  const labeled = text.match(/(?:^|\n)\s*(?:name|full name)\s*[:\-]\s*([A-Za-z][A-Za-z.'-]+(?:\s+[A-Za-z][A-Za-z.'-]+){0,3})/i);
  if (labeled) return labeled[1].trim();
  for (const line of lines.slice(0, 6)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 45) continue;
    if (/resume|curriculum|vitae|@|https?:\/\/|\d{3}/i.test(trimmed)) continue;
    if (/^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}$/.test(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

function extractEmail(text: string): string | null {
  const match = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return match ? match[0] : null;
}

function extractPhone(text: string): string | null {
  const match = text.match(/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s-]?)?\d{3}[\s-]?\d{3,4}(?:[\s-]?\d{2,4})?/);
  if (!match) return null;
  const digits = match[0].replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return match[0].trim();
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

function monthsBetween(startYear: number, startMonth: number, endYear: number, endMonth: number): number {
  return Math.max(0, (endYear - startYear) * 12 + (endMonth - startMonth));
}

function extractExperienceMonths(text: string): number {
  let total = 0;
  const rangeRegex = /([A-Za-z]{3,9})\.?\s+(\d{4})\s*(?:-|–|to)\s*(?:([A-Za-z]{3,9})\.?\s+)?(\d{4}|present|current)/gi;
  let match: RegExpExecArray | null;
  const now = new Date();
  while ((match = rangeRegex.exec(text)) !== null) {
    const startMonth = MONTH_INDEX[match[1].toLowerCase()];
    if (startMonth === undefined) continue;
    const startYear = Number(match[2]);
    let endMonth: number;
    let endYear: number;
    const endToken = match[4].toLowerCase();
    if (endToken === "present" || endToken === "current") {
      endMonth = now.getMonth();
      endYear = now.getFullYear();
    } else {
      endYear = Number(match[4]);
      endMonth = match[3] ? MONTH_INDEX[match[3].toLowerCase()] : startMonth;
      if (endMonth === undefined) endMonth = startMonth;
    }
    const span = monthsBetween(startYear, startMonth, endYear, endMonth);
    if (span > 0 && span <= 60) total += span;
  }
  const yearMatch = text.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|internship)/i);
  if (yearMatch && total === 0) total += Math.round(Number(yearMatch[1]) * 12);
  const monthMatch = text.match(/(\d+)\s*\+?\s*months?\s+(?:of\s+)?(?:experience|internship)/i);
  if (monthMatch && total === 0) total += Number(monthMatch[1]);
  return Math.min(120, total);
}

function deriveTargetRoles(text: string, skills: string[]): string[] {
  const roles = new Set<string>();
  for (const entry of ROLE_PATTERNS) {
    if (entry.pattern.test(text)) roles.add(entry.title);
  }
  const has = (skill: string) => skills.includes(skill);
  if (has("Machine Learning") || has("Deep Learning") || has("TensorFlow") || has("PyTorch")) {
    roles.add("Machine Learning Engineer");
    roles.add("Data Scientist");
  }
  if (has("React") || has("Next.js") || has("Vue") || has("Angular") || has("HTML")) {
    roles.add("Frontend Engineer");
  }
  if (has("Node.js") || has("Django") || has("Flask") || has("FastAPI") || has("Java") || has("Spring Boot")) {
    roles.add("Backend Engineer");
  }
  if (has("AWS") || has("Docker") || has("Kubernetes") || has("CI/CD")) {
    roles.add("DevOps Engineer");
  }
  if (roles.size === 0) roles.add("Software Engineer");
  return [...roles].slice(0, 6);
}

const SCHOOL_DEGREES: { degree: string; regex: RegExp }[] = [
  { degree: "H.S.C", regex: /\bH\.?\s?S\.?\s?C\b/i },
  { degree: "S.S.C", regex: /\bS\.?\s?S\.?\s?C\b/i },
  { degree: "12th", regex: /\b(?:12th|xii|senior\s+secondary|higher\s+secondary)\b/i },
  { degree: "10th", regex: /\b(?:10th|matriculation)\b/i },
];

const DEGREE_SPECIALIZATIONS: Record<string, string> = {
  MCA: "Computer Applications",
  BCA: "Computer Applications",
  MBA: "Business Administration",
  BBA: "Business Administration",
  "M.Com": "Commerce",
  "B.Com": "Commerce",
  MA: "Arts",
};

function cleanEducationLine(line: string): string {
  return line
    .replace(/\s+/g, " ")
    .replace(/^[•\-–—*]\s*/, "")
    .trim();
}

function extractEducationScore(text: string): string | null {
  const cgpa = text.match(/\b(?:cgpa|cpi|gpa)\s*[:\-–]?\s*(\d{1,2}(?:\.\d{1,2})?)/i);
  if (cgpa) return `CGPA ${cgpa[1]}`;
  const percentage = text.match(/(\d{1,3}(?:\.\d{1,2})?)\s*%/);
  if (percentage) return `${percentage[1]}%`;
  const labeled = text.match(/\bpercentage\s*[:\-–]?\s*(\d{1,3}(?:\.\d{1,2})?)/i);
  if (labeled) return `${labeled[1]}%`;
  return null;
}

function extractEducationYear(text: string): string | null {
  const range = text.match(
    /\b((?:19|20)\d{2})\s*(?:-|–|to)\s*((?:19|20)\d{2}|present|current)\b/i,
  );
  if (range) return `${range[1]}-${range[2]}`;
  const single = text.match(/\b((?:19|20)\d{2})\b/);
  return single ? single[1] : null;
}

function stripEducationYear(line: string): string {
  return line
    .replace(
      /\b(?:19|20)\d{2}\s*(?:-|–|to)\s*(?:(?:19|20)\d{2}|present|current)\b/gi,
      "",
    )
    .replace(/\b(?:19|20)\d{2}\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s,;|–-]+$/g, "")
    .trim();
}

function looksLikeInstitution(line: string): boolean {
  return (
    /college|university|institute|school|academy|polytechnic|vidyalaya/i.test(line) ||
    /\b(?:19|20)\d{2}\b/.test(line)
  );
}

function parseEducationLine(
  line: string,
): { degree: string; specialization: string | null; score: string | null } | null {
  let degree = detectDegrees(line)[0] ?? null;
  if (!degree) {
    for (const entry of SCHOOL_DEGREES) {
      if (entry.regex.test(line)) {
        degree = entry.degree;
        break;
      }
    }
  }
  if (!degree) return null;

  let specialization = detectBranches(line)[0] ?? null;
  if (!specialization) {
    const parenthetical = line.match(/\(([^)]{2,40})\)/);
    if (parenthetical) specialization = parenthetical[1].trim();
  }
  if (!specialization) {
    specialization = DEGREE_SPECIALIZATIONS[degree] ?? null;
  }
  if (!specialization) {
    const match = line.match(
      /\b(?:in|speciali[sz](?:ed|ation)\s+in)\s+([A-Za-z][A-Za-z &/-]{1,40})/i,
    );
    if (match) {
      specialization = match[1]
        .replace(/\s*(?:[-–,(]|cgpa|cpi|gpa|percentage).*$/i, "")
        .trim();
    }
  }

  return { degree, specialization, score: extractEducationScore(line) };
}

function extractEducation(lines: string[]): EducationEntry[] {
  const heading = lines.findIndex((line) =>
    /^(education|academic background|academic qualifications?|educational qualifications?|qualifications?)\b/i.test(
      line.trim(),
    ),
  );
  const section: string[] = [];
  if (heading >= 0) {
    for (let index = heading + 1; index < lines.length; index += 1) {
      const trimmed = lines[index].trim();
      if (!trimmed) {
        if (section.length > 0) break;
        continue;
      }
      if (isHeading(trimmed) && section.length > 0) break;
      section.push(trimmed);
      if (section.length >= 40) break;
    }
  } else {
    for (const line of lines) {
      if (parseEducationLine(cleanEducationLine(line))) section.push(line);
    }
  }

  const entries: EducationEntry[] = [];
  let pendingInstitution: string | null = null;
  let pendingYear: string | null = null;

  for (let index = 0; index < section.length; index += 1) {
    const line = cleanEducationLine(section[index]);
    if (!line) continue;
    const parsed = parseEducationLine(line);
    if (!parsed) {
      if (looksLikeInstitution(line)) {
        pendingInstitution = stripEducationYear(line) || null;
        pendingYear = extractEducationYear(line);
      }
      continue;
    }

    const previous = index > 0 ? cleanEducationLine(section[index - 1]) : "";
    let institution = pendingInstitution;
    if (
      !institution &&
      previous &&
      looksLikeInstitution(previous) &&
      !parseEducationLine(previous)
    ) {
      institution = stripEducationYear(previous) || null;
      pendingYear = pendingYear ?? extractEducationYear(previous);
    }
    if (!institution) {
      const next =
        index + 1 < section.length ? cleanEducationLine(section[index + 1]) : "";
      if (next && looksLikeInstitution(next) && !parseEducationLine(next)) {
        institution = stripEducationYear(next) || null;
      }
    }

    entries.push({
      degree: parsed.degree,
      specialization: parsed.specialization,
      institution,
      year: pendingYear ?? extractEducationYear(line),
      score: parsed.score,
    });
    pendingInstitution = null;
    pendingYear = null;
  }

  return entries.slice(0, 8);
}

export function parseResume(rawText: string, fileName: string): ResumeProfile {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\t/g, " ");
  const lines = normalized.split("\n");
  const skills = normalizeSkillList([
    ...extractSkillsFromText(normalized),
    ...extractSkillsFromText(extractSection(lines, /^(technical\s+)?skills\b/i).join(" ")),
    ...extractSection(lines, /^(technical\s+)?skills\b/i)
      .flatMap((line) => line.split(/[,|•·;]/))
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && token.length < 30),
  ]);
  const branches = detectBranches(normalized);
  const degrees = detectDegrees(normalized);
  const gradYears = extractGraduationYears(normalized);
  const education = extractEducation(lines);
  const highestDegree = degrees[0] ?? null;
  const highestEducation = highestDegree
    ? education.find((entry) => entry.degree === highestDegree)
    : undefined;
  const certificationLines = extractSection(
    lines,
    /^(certifications?|certificates?|licenses?)\b/i,
  );

  return {
    fileName,
    rawText: normalized.slice(0, 40000),
    name: extractName(normalized, lines),
    email: extractEmail(normalized),
    phone: extractPhone(normalized),
    degree: highestDegree,
    branch: highestEducation ? highestEducation.specialization : branches[0] ?? null,
    cgpa: extractCgpa(normalized),
    graduationYear: gradYears.length > 0 ? Math.max(...gradYears) : null,
    education,
    skills,
    targetRoles: deriveTargetRoles(normalized, skills),
    experienceMonths: extractExperienceMonths(normalized),
    projects: extractSection(lines, /^(academic\s+)?projects?\b/i).slice(0, 8),
    certifications: certificationLines.slice(0, 10),
    updatedAt: new Date().toISOString(),
  };
}

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

export async function parseResumeFile(fileName: string, data: Buffer): Promise<ResumeProfile> {
  const text = await extractDocumentText(fileName, data);
  if (!text.trim()) {
    throw new Error("Could not extract any text from the uploaded file. Is it a scanned PDF?");
  }
  return parseResume(text, fileName);
}
