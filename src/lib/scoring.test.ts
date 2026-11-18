import { describe, expect, it } from "vitest";
import { scoreJob } from "./scoring";
import type { JobRecord, ResumeProfile } from "./types";

const now = new Date().toISOString();

function makeResume(overrides: Partial<ResumeProfile> = {}): ResumeProfile {
  return {
    fileName: "resume.pdf",
    rawText: "",
    name: "Test Student",
    email: "test@iitb.ac.in",
    phone: null,
    degree: "B.Tech",
    branch: "Computer Science",
    cgpa: 8.5,
    graduationYear: 2026,
    education: [],
    skills: ["React", "TypeScript", "Node.js", "Python"],
    targetRoles: ["Software Engineer", "Full Stack Developer"],
    experienceMonths: 6,
    projects: [],
    certifications: [],
    updatedAt: now,
    ...overrides,
  };
}

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 1,
    externalId: "job-1",
    title: "Software Engineer",
    company: "Acme",
    location: "Bengaluru",
    jobType: "Full-time",
    ctc: "20 LPA",
    stipend: null,
    eligibleBranches: ["All Branches"],
    eligibleDegrees: [],
    minCgpa: null,
    graduationYears: [],
    deadline: null,
    description: "Build web applications.",
    applyUrl: null,
    requiredSkills: ["React", "TypeScript", "Node.js"],
    preferredSkills: ["AWS"],
    rawText: "Acme | Software Engineer",
    jdStatus: "ok",
    jdSource: "native",
    jdFetchedAt: now,
    jdCharCount: 26,
    jdError: null,
    jdPdfPath: null,
    firstSeenAt: now,
    lastSeenAt: now,
    ...overrides,
  };
}

describe("scoreJob", () => {
  it("scores a well-matched eligible job highly", () => {
    const result = scoreJob(makeResume(), makeJob());
    expect(result.eligible).toBe(true);
    expect(result.total).toBeGreaterThan(60);
    expect(result.matchedSkills).toContain("React");
    expect(result.matchedSkills).toContain("TypeScript");
    expect(result.missingMustHave).toHaveLength(0);
  });

  it("caps ineligible jobs and marks them low chance", () => {
    const result = scoreJob(
      makeResume({ branch: "Computer Science" }),
      makeJob({ eligibleBranches: ["Mechanical"] }),
    );
    expect(result.eligible).toBe(false);
    expect(result.total).toBeLessThanOrEqual(25);
    expect(result.chance).toBe("Low");
    expect(result.checks.some((check) => check.label === "Branch / discipline" && !check.passed)).toBe(
      true,
    );
  });

  it("reports missing must-have skills", () => {
    const result = scoreJob(
      makeResume({ skills: ["React"] }),
      makeJob({ requiredSkills: ["Kubernetes", "Docker"], preferredSkills: [] }),
    );
    expect(result.missingMustHave).toEqual(expect.arrayContaining(["Kubernetes", "Docker"]));
    expect(result.matchedSkills).not.toContain("Kubernetes");
  });

  it("fails the deadline check when the deadline has passed", () => {
    const result = scoreJob(makeResume(), makeJob({ deadline: "2020-01-01" }));
    const deadlineCheck = result.checks.find((check) => check.label === "Deadline");
    expect(deadlineCheck?.passed).toBe(false);
    expect(result.eligible).toBe(false);
  });

  it("respects CGPA cutoffs", () => {
    const failing = scoreJob(makeResume({ cgpa: 6 }), makeJob({ minCgpa: 7 }));
    expect(failing.eligible).toBe(false);
    const passing = scoreJob(makeResume({ cgpa: 8 }), makeJob({ minCgpa: 7 }));
    expect(passing.eligible).toBe(true);
  });

  it("treats missing branches as open to all", () => {
    const result = scoreJob(makeResume(), makeJob({ eligibleBranches: [] }));
    const branchCheck = result.checks.find((check) => check.label === "Branch / discipline");
    expect(branchCheck?.passed).toBe(true);
  });

  it("uses the full education history for eligibility", () => {
    const result = scoreJob(
      makeResume({
        degree: "MCA",
        branch: "Computer Applications",
        education: [
          {
            degree: "MCA",
            specialization: "Computer Applications",
            institution: "DES NMITD",
            year: "2023-2025",
            score: "CGPA 8.6",
          },
          {
            degree: "B.Sc",
            specialization: "Information Technology",
            institution: "Chandrabhan Sharma College",
            year: "2020-2023",
            score: "CGPA 9.08",
          },
        ],
      }),
      makeJob({
        eligibleBranches: ["Information Technology"],
        eligibleDegrees: ["B.Sc"],
      }),
    );
    expect(result.eligible).toBe(true);
  });

  it("handles jobs without listed skills without crashing", () => {
    const result = scoreJob(
      makeResume(),
      makeJob({ requiredSkills: [], preferredSkills: [] }),
    );
    expect(result.skillScore).toBe(50);
    expect(Number.isFinite(result.total)).toBe(true);
  });
});
