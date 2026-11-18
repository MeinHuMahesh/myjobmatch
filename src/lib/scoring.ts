import type {
  Chance,
  EligibilityCheck,
  JobRecord,
  ResumeProfile,
  ScoreBreakdown,
} from "./types";

export const SCORING_WEIGHTS = {
  skills: 0.5,
  role: 0.3,
  experience: 0.2,
} as const;

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "at", "with",
  "is", "are", "be", "as", "by", "we", "you", "our", "your", "will", "who",
  "this", "that", "from", "have", "has", "job", "role", "position", "work",
  "team", "company", "candidate", "candidates", "looking", "required", "must",
]);

const ROLE_SYNONYMS: Record<string, string[]> = {
  software: ["sde", "developer", "engineer", "programmer", "swe"],
  sde: ["software", "engineer", "developer"],
  developer: ["engineer", "software", "programmer", "sde"],
  engineer: ["developer", "software", "sde"],
  frontend: ["front", "ui", "web", "react"],
  backend: ["back", "server", "api"],
  fullstack: ["full", "stack", "software", "web"],
  data: ["analytics", "science", "scientist", "analyst"],
  machine: ["ml", "learning", "ai"],
  learning: ["ml", "machine", "ai"],
  ml: ["machine", "learning", "ai"],
  ai: ["ml", "machine", "learning", "artificial", "intelligence"],
  devops: ["sre", "infrastructure", "cloud", "platform"],
  analyst: ["analysis", "analytics", "data"],
  intern: ["internship", "trainee"],
  internship: ["intern", "trainee"],
  research: ["r&d", "scientist"],
};

function tokenize(value: string): Set<string> {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9+/#. ]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
  return new Set(tokens);
}

function expand(tokens: Set<string>): Set<string> {
  const out = new Set(tokens);
  for (const token of tokens) {
    for (const synonym of ROLE_SYNONYMS[token] ?? []) out.add(synonym);
  }
  return out;
}

function key(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeDegree(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function branchMatches(resumeBranch: string, eligibleBranch: string): boolean {
  const a = resumeBranch.toLowerCase();
  const b = eligibleBranch.toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

function uniqueStrings(values: (string | null | undefined)[]): string[] {
  return [
    ...new Set(
      values
        .filter((value): value is string => Boolean(value && value.trim()))
        .map((value) => value.trim()),
    ),
  ];
}

function parseDeadline(deadline: string | null): Date | null {
  if (!deadline) return null;
  const parsed = Date.parse(deadline);
  if (Number.isFinite(parsed)) return new Date(parsed);
  const match = deadline.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function requiredExperienceMonths(job: JobRecord): number | null {
  const text = `${job.title}\n${job.description ?? ""}\n${job.rawText}`;
  const match = text.match(
    /(?:min(?:imum)?\s*(?:of\s*)?)?(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:relevant\s*)?experience/i,
  );
  if (!match) return null;
  return Math.round(Number(match[1]) * 12);
}

export function evaluateEligibility(resume: ResumeProfile, job: JobRecord): EligibilityCheck[] {
  const checks: EligibilityCheck[] = [];

  const branches = job.eligibleBranches;
  const branchOpen = branches.length === 0 || branches.some((b) => /all branches/i.test(b));
  const resumeBranches = uniqueStrings([
    resume.branch,
    ...(resume.education ?? []).map((entry) => entry.specialization),
  ]);
  const branchHit =
    resumeBranches.find((candidate) =>
      branches.some((branch) => branchMatches(candidate, branch)),
    ) ?? null;
  checks.push({
    label: "Branch / discipline",
    passed: branchOpen || branchHit !== null,
    detail: branchOpen
      ? "Open to all branches"
      : branchHit
        ? `Your branch (${branchHit}) is eligible`
        : `Eligible: ${branches.join(", ")}${
            resumeBranches.length > 0 ? ` — yours: ${resumeBranches.join(", ")}` : ""
          }`,
  });

  const degrees = job.eligibleDegrees;
  const resumeDegrees = uniqueStrings([
    resume.degree,
    ...(resume.education ?? []).map((entry) => entry.degree),
  ]);
  const degreeHit =
    resumeDegrees.find((candidate) =>
      degrees.some(
        (degree) => normalizeDegree(degree) === normalizeDegree(candidate),
      ),
    ) ?? null;
  checks.push({
    label: "Degree",
    passed: degrees.length === 0 || degreeHit !== null,
    detail:
      degrees.length === 0
        ? "No specific degree required"
        : degreeHit
          ? `Your degree (${degreeHit}) qualifies`
          : `Eligible: ${degrees.join(", ")}${
              resumeDegrees.length > 0 ? ` — yours: ${resumeDegrees.join(", ")}` : ""
            }`,
  });

  checks.push({
    label: "CGPA / CPI",
    passed: job.minCgpa === null || (resume.cgpa !== null && resume.cgpa >= job.minCgpa),
    detail:
      job.minCgpa === null
        ? "No CGPA cutoff listed"
        : resume.cgpa === null
          ? `Requires ${job.minCgpa}+ (CGPA not found in resume)`
          : resume.cgpa >= job.minCgpa
            ? `Your ${resume.cgpa} meets the ${job.minCgpa} cutoff`
            : `Requires ${job.minCgpa}+, you have ${resume.cgpa}`,
  });

  const years = job.graduationYears;
  const yearHit = resume.graduationYear !== null && years.includes(resume.graduationYear);
  checks.push({
    label: "Graduation year",
    passed: years.length === 0 || yearHit,
    detail:
      years.length === 0
        ? "No batch restriction listed"
        : yearHit
          ? `Your batch (${resume.graduationYear}) is eligible`
          : `Eligible batches: ${years.join(", ")}${resume.graduationYear ? ` — yours is ${resume.graduationYear}` : ""}`,
  });

  const deadline = parseDeadline(job.deadline);
  const notExpired = deadline === null || deadline.getTime() >= Date.now() - 24 * 60 * 60 * 1000;
  checks.push({
    label: "Deadline",
    passed: notExpired,
    detail: deadline === null
      ? "No parsable deadline"
      : notExpired
        ? `Applications accepted until ${deadline.toDateString()}`
        : `Deadline passed on ${deadline.toDateString()}`,
  });

  return checks;
}

function skillScoreFor(resume: ResumeProfile, job: JobRecord): {
  score: number;
  matched: string[];
  missingMust: string[];
  missingNice: string[];
} {
  const resumeSet = new Set(resume.skills.map((skill) => key(skill)));
  const required = job.requiredSkills;
  const preferred = job.preferredSkills;
  if (required.length + preferred.length === 0) {
    return {
      score: 50,
      matched: [],
      missingMust: [],
      missingNice: [],
      };
  }
  let totalWeight = 0;
  let earned = 0;
  const matched: string[] = [];
  const missingMust: string[] = [];
  const missingNice: string[] = [];
  for (const skill of required) {
    totalWeight += 2;
    if (resumeSet.has(key(skill))) {
      earned += 2;
      matched.push(skill);
    } else {
      missingMust.push(skill);
    }
  }
  for (const skill of preferred) {
    totalWeight += 1;
    if (resumeSet.has(key(skill))) {
      earned += 1;
      matched.push(skill);
    } else {
      missingNice.push(skill);
    }
  }
  return {
    score: totalWeight === 0 ? 50 : Math.round((earned / totalWeight) * 100),
    matched: [...new Set(matched)].sort(),
    missingMust: [...new Set(missingMust)].sort(),
    missingNice: [...new Set(missingNice)].sort(),
  };
}

function roleScoreFor(resume: ResumeProfile, job: JobRecord): number {
  const titleTokens = expand(tokenize(job.title));
  if (titleTokens.size === 0) return 50;
  const resumeTokens = expand(
    tokenize(`${resume.targetRoles.join(" ")} ${resume.skills.join(" ")} ${resume.projects.join(" ")}`),
  );
  let overlap = 0;
  for (const token of titleTokens) {
    if (resumeTokens.has(token)) overlap += 1;
  }
  const titleScore = Math.min(100, Math.round((overlap / titleTokens.size) * 100));

  const jobSkills = new Set([...job.requiredSkills, ...job.preferredSkills].map((s) => key(s)));
  let skillOverlap = 0;
  if (jobSkills.size > 0) {
    for (const skill of resume.skills) {
      if (jobSkills.has(key(skill))) skillOverlap += 1;
    }
    skillOverlap = Math.min(100, Math.round((skillOverlap / jobSkills.size) * 100));
  } else {
    skillOverlap = titleScore;
  }

  return Math.round(titleScore * 0.6 + skillOverlap * 0.4);
}

function experienceScoreFor(resume: ResumeProfile, job: JobRecord): number {
  const required = requiredExperienceMonths(job);
  const isInternship = /intern/i.test(`${job.jobType ?? ""} ${job.title}`);
  if (required === null) {
    if (isInternship) return resume.experienceMonths > 0 ? 100 : 70;
    return resume.experienceMonths > 0 ? 85 : 70;
  }
  if (resume.experienceMonths >= required) return 100;
  if (required === 0) return 100;
  return Math.max(10, Math.round((resume.experienceMonths / required) * 100));
}

function chanceFor(total: number, eligible: boolean): Chance {
  if (!eligible) return "Low";
  if (total >= 72) return "High";
  if (total >= 52) return "Medium";
  return "Low";
}

function buildSummary(
  eligible: boolean,
  total: number,
  matched: string[],
  missingMust: string[],
  checks: EligibilityCheck[],
): string {
  if (!eligible) {
    const failed = checks.filter((check) => !check.passed).map((check) => check.label);
    return `Not eligible due to: ${failed.join(", ")}.`;
  }
  const parts: string[] = [];
  if (missingMust.length === 0 && matched.length > 0) {
    parts.push(`All listed must-have skills covered (${matched.length} matched)`);
  } else if (matched.length > 0) {
    parts.push(`${matched.length} skills matched, ${missingMust.length} must-have missing`);
  } else {
    parts.push("Eligible, but few skill matches found");
  }
  if (missingMust.length > 0) {
    parts.push(`focus on: ${missingMust.slice(0, 4).join(", ")}`);
  }
  const band = total >= 72 ? "Strong" : total >= 52 ? "Moderate" : "Low";
  return `${band} fit. ${parts.join("; ")}.`;
}

export function scoreJob(resume: ResumeProfile, job: JobRecord): ScoreBreakdown {
  const checks = evaluateEligibility(resume, job);
  const eligible = checks.every((check) => check.passed);
  const skills = skillScoreFor(resume, job);
  const roleScore = roleScoreFor(resume, job);
  const experienceScore = experienceScoreFor(resume, job);

  let total =
    skills.score * SCORING_WEIGHTS.skills +
    roleScore * SCORING_WEIGHTS.role +
    experienceScore * SCORING_WEIGHTS.experience;

  if (!eligible) total = Math.min(25, total * 0.4);
  const rounded = Math.max(0, Math.min(100, Math.round(total)));

  return {
    total: rounded,
    chance: chanceFor(rounded, eligible),
    eligible,
    summary: buildSummary(eligible, rounded, skills.matched, skills.missingMust, checks),
    skillScore: skills.score,
    roleScore,
    experienceScore,
    matchedSkills: skills.matched,
    missingMustHave: skills.missingMust,
    missingNiceToHave: skills.missingNice,
    checks,
  };
}

export function scoreAllJobs(
  resume: ResumeProfile,
  jobs: JobRecord[],
): { job: JobRecord; score: ScoreBreakdown }[] {
  return jobs.map((job) => ({ job, score: scoreJob(resume, job) }));
}
