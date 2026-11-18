import { describe, expect, it } from "vitest";
import { detectDegrees } from "./extract";
import { parseResume } from "./parseResume";

const EDUCATION = `EDUCATION
DES Navinchandra Mehta Institute of Technology and Development 2023-2025
Master of Computer Application - CGPA - 8.6
Chandrabhan Sharma College 2020-2023
Bachelor of Science in Information Technology - CGPA - 9.08
SKILLS
Java, Spring Boot, React
`;

describe("detectDegrees", () => {
  it("ranks a master's degree above a bachelor's degree", () => {
    expect(detectDegrees(EDUCATION)[0]).toBe("MCA");
    expect(detectDegrees(EDUCATION)).toContain("B.Sc");
  });

  it("recognises MCA abbreviations", () => {
    expect(detectDegrees("M.C.A. from Mumbai University")).toContain("MCA");
    expect(detectDegrees("MCA graduate with 2 years experience")).toContain("MCA");
  });

  it("does not treat MS Office as a degree", () => {
    expect(detectDegrees("Advanced MS Office and Excel")).not.toContain("MS");
  });

  it("keeps PhD above master's degrees", () => {
    expect(detectDegrees("M.Tech and PhD in Computer Science")[0]).toBe("PhD");
  });
});

describe("parseResume degree selection", () => {
  it("uses the highest qualification as the profile degree", () => {
    const profile = parseResume(EDUCATION, "resume.pdf");
    expect(profile.degree).toBe("MCA");
    expect(profile.branch).toBe("Computer Applications");
  });

  it("captures the specialization for every degree", () => {
    const profile = parseResume(EDUCATION, "resume.pdf");
    expect(profile.education).toHaveLength(2);
    expect(profile.education[0]).toMatchObject({
      degree: "MCA",
      specialization: "Computer Applications",
      year: "2023-2025",
      score: "CGPA 8.6",
    });
    expect(profile.education[1]).toMatchObject({
      degree: "B.Sc",
      specialization: "Information Technology",
      year: "2020-2023",
      score: "CGPA 9.08",
    });
  });
});
