import { extractSkillsFromText } from "./skills";

const BRANCH_ALIASES: { name: string; aliases: string[] }[] = [
  { name: "Computer Science", aliases: ["cse", "computer science", "computer science and engineering", "computer science & engineering", "cs engineering"] },
  { name: "Information Technology", aliases: ["information technology", "it engineering"] },
  { name: "Electronics", aliases: ["electronics and communication", "electronics & communication", "electronics and telecommunication", "ece", "electronics"] },
  { name: "Electrical", aliases: ["electrical engineering", "electrical and electronics", "eee", "electrical"] },
  { name: "Mechanical", aliases: ["mechanical engineering", "mechanical", "mech"] },
  { name: "Civil", aliases: ["civil engineering", "civil"] },
  { name: "Chemical", aliases: ["chemical engineering", "chemical"] },
  { name: "Aerospace", aliases: ["aerospace engineering", "aerospace", "aeronautical"] },
  { name: "Metallurgy", aliases: ["metallurgy", "metallurgical", "materials science"] },
  { name: "Engineering Physics", aliases: ["engineering physics"] },
  { name: "Mathematics and Computing", aliases: ["mathematics and computing", "maths and computing", "math and computing", "mathematics & computing"] },
  { name: "Energy", aliases: ["energy engineering", "energy systems", "energy science"] },
  { name: "Biosciences", aliases: ["biosciences", "biotechnology", "bioengineering", "bio engineering"] },
  { name: "Data Science", aliases: ["data science and engineering", "data science"] },
  { name: "Artificial Intelligence", aliases: ["artificial intelligence", "ai and data science"] },
];

const ALL_BRANCH_PATTERNS = [
  /all\s+(?:the\s+)?(?:engineering\s+)?branches?/i,
  /any\s+(?:engineering\s+)?branch/i,
  /all\s+disciplines?/i,
  /open\s+to\s+all/i,
  /irrespective\s+of\s+(?:the\s+)?branch/i,
];

const DEGREE_PATTERNS: { name: string; rank: number; regex: RegExp }[] = [
  { name: "PhD", rank: 5, regex: /\bph\.?\s?d\b|\bdoctorate\b|\bdoctoral\b/i },
  { name: "M.Phil", rank: 4, regex: /\bm\.?\s?phil\b|\bmaster of philosophy\b/i },
  { name: "M.Tech", rank: 3, regex: /\bm\.?\s?tech\b|\bmtech\b|\bmaster of technology\b/i },
  { name: "MS", rank: 3, regex: /\bm\.?s\.?\b(?!\s*office)/i },
  { name: "MBA", rank: 3, regex: /\bmba\b|\bmaster of business administration\b/i },
  { name: "MCA", rank: 3, regex: /\bm\.?\s?c\.?\s?a\.?\b|\bmca\b|\bmaster of computer applications?\b/i },
  { name: "M.Sc", rank: 3, regex: /\bm\.?\s?sc\b|\bmaster of science\b/i },
  { name: "MA", rank: 3, regex: /\bm\.?\s?a\.?\b|\bmaster of arts\b/i },
  { name: "M.Com", rank: 3, regex: /\bm\.?\s?com\b|\bmaster of commerce\b/i },
  { name: "Dual Degree", rank: 3, regex: /\bdual\s+degree\b|\bb\.?\s?tech\s*[-+]\s*m\.?\s?tech\b/i },
  { name: "B.Tech", rank: 2, regex: /\bb\.?\s?tech\b|\bbtech\b|\bbachelor of technology\b/i },
  { name: "BS", rank: 2, regex: /\bb\.?\s?s\.?\b/i },
  { name: "B.Sc", rank: 2, regex: /\bb\.?\s?sc\b|\bbachelor of science\b/i },
  { name: "BCA", rank: 2, regex: /\bb\.?\s?c\.?\s?a\.?\b|\bbca\b|\bbachelor of computer applications?\b/i },
  { name: "BBA", rank: 2, regex: /\bbba\b|\bbachelor of business administration\b/i },
  { name: "B.Com", rank: 2, regex: /\bb\.?\s?com\b|\bbachelor of commerce\b/i },
];

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function detectBranches(text: string): string[] {
  if (!text) return [];
  if (ALL_BRANCH_PATTERNS.some((re) => re.test(text))) return ["All Branches"];
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const branch of BRANCH_ALIASES) {
    for (const alias of branch.aliases) {
      const pattern = new RegExp(`(^|[^a-z])${escapeRegex(alias)}([^a-z]|$)`, "i");
      if (pattern.test(lower)) {
        found.push(branch.name);
        break;
      }
    }
  }
  return unique(found);
}

export function detectDegrees(text: string): string[] {
  if (!text) return [];
  return unique(
    DEGREE_PATTERNS.filter((entry) => entry.regex.test(text))
      .sort((a, b) => b.rank - a.rank)
      .map((entry) => entry.name),
  );
}

export function extractCgpa(text: string): number | null {
  if (!text) return null;
  const patterns = [
    /min(?:imum)?[^.\n]{0,25}(?:cgpa|cpi|gpa)[^0-9]{0,12}(\d{1,2}(?:\.\d{1,2})?)/i,
    /(?:cgpa|cpi|gpa)[^0-9\n]{0,15}(\d{1,2}(?:\.\d{1,2})?)/i,
    /(?:at\s+least|above|cut\s?off)[^0-9\n]{0,15}(\d{1,2}\.\d{1,2})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value >= 0 && value <= 10) return value;
    }
  }
  return null;
}

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";

export function extractDeadline(text: string): string | null {
  if (!text) return null;
  const patterns: RegExp[] = [
    new RegExp(`deadline[^0-9]{0,25}(\\d{1,2}\\s+(?:${MONTHS})[a-z]*\\s+\\d{4})`, "i"),
    new RegExp(`(?:apply\\s+(?:by|before)|last\\s+date)[^0-9]{0,25}(\\d{1,2}\\s+(?:${MONTHS})[a-z]*\\s+\\d{4})`, "i"),
    /deadline[^0-9]{0,25}(\d{4}-\d{2}-\d{2})/i,
    /deadline[^0-9]{0,25}(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    new RegExp(`(\\d{1,2}\\s+(?:${MONTHS})[a-z]*\\s+\\d{4})`, "i"),
    /(\d{4}-\d{2}-\d{2})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

export function extractGraduationYears(text: string): number[] {
  if (!text) return [];
  const years = new Set<number>();
  const context = /(?:batch|graduat\w*|passing|pass\s?out|year\s+of\s+passing)[^0-9]{0,25}(20\d{2})/gi;
  let match: RegExpExecArray | null;
  while ((match = context.exec(text)) !== null) {
    years.add(Number(match[1]));
  }
  if (years.size === 0) {
    const range = /\b(20\d{2})\s*(?:-|–|to)\s*(20\d{2})\b/g;
    while ((match = range.exec(text)) !== null) {
      const start = Number(match[1]);
      const end = Number(match[2]);
      if (end >= start && end - start <= 6) {
        for (let year = start; year <= end; year += 1) years.add(year);
      }
    }
  }
  return [...years].filter((year) => year >= 2020 && year <= 2035).sort();
}

export function extractCtc(text: string): string | null {
  if (!text) return null;
  const match = text.match(
    /(?:ctc|package|compensation|salary)\s*[:\-]?\s*((?:inr|rs\.?|₹)?\s*[0-9][0-9.,]*\s*(?:lpa|lakhs?|lakh\s+per\s+annum|crore|cr\.?|per\s+annum|pa)[^\n,;]{0,25})/i,
  );
  return match ? match[1].trim() : null;
}

export function extractStipend(text: string): string | null {
  if (!text) return null;
  const match = text.match(
    /stipend\s*[:\-]?\s*((?:inr|rs\.?|₹)?\s*[0-9][0-9.,]*\s*(?:k|per\s+month|pm|\/\s?month|monthly)?[^\n,;]{0,25})/i,
  );
  return match ? match[1].trim() : null;
}

export function extractLocation(text: string): string | null {
  if (!text) return null;
  const match = text.match(/(?:location|based\s+(?:in|at)|city)\s*[:\-]?\s*([A-Za-z][A-Za-z .&#/-]{1,50})/i);
  return match ? match[1].trim() : null;
}

export function extractJobType(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/\b(internship|intern)\b/.test(lower) && /\b(ppo|pre[\s-]?placement)\b/.test(lower)) {
    return "Internship + PPO";
  }
  if (/\b(internship|intern)\b/.test(lower)) return "Internship";
  if (/\b(full[\s-]?time|fte|full time)\b/.test(lower)) return "Full-time";
  if (/\b(part[\s-]?time)\b/.test(lower)) return "Part-time";
  if (/\b(contract)\b/.test(lower)) return "Contract";
  return null;
}

function sectionText(text: string, headingRegex: RegExp): string {
  const lines = text.split(/\r?\n/);
  const collected: string[] = [];
  let capturing = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (headingRegex.test(trimmed) && trimmed.length < 90) {
      capturing = true;
      continue;
    }
    if (capturing && trimmed.length > 0 && /^[A-Z][A-Za-z /&]{2,40}:?$/.test(trimmed) && trimmed.split(/\s+/).length <= 5) {
      if (extractSkillsFromText(trimmed).length === 0) {
        capturing = false;
      }
    }
    if (capturing) collected.push(trimmed);
  }
  return collected.join("\n") || text;
}

export function extractRequiredSkills(text: string): string[] {
  if (!text) return [];
  const preferred = extractPreferredSkills(text);
  const source = sectionText(text, /^(skills|required skills|requirements|eligibility|qualifications|technical skills)\b/i);
  const fromSection = extractSkillsFromText(source);
  const fromAll = extractSkillsFromText(text);
  const required = new Set([...fromSection, ...fromAll]);
  for (const skill of preferred) required.delete(skill);
  return [...required].sort();
}

export function extractPreferredSkills(text: string): string[] {
  if (!text) return [];
  const source = sectionText(text, /^(preferred|good to have|nice to have|bonus|plus points)\b/i);
  if (source === text) {
    const inline = text.match(/(?:preferred|good\s+to\s+have|nice\s+to\s+have)[^\n.]{0,180}/i);
    return inline ? extractSkillsFromText(inline[0]) : [];
  }
  return extractSkillsFromText(source).sort();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
