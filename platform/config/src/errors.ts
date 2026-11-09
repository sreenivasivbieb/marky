import type { ZodError } from "zod";

/**
 * Config galat ho to yahi error aata hai.
 *
 * Message me sirf field ka path aur kya galat hai, ye dono hote hain. Input VALUE kabhi nahi hoti,
 * taaki DATABASE_URL jaisi secret values logs me na pahunchein (ADR 0017).
 */
export class ConfigError extends Error {
  readonly problems: readonly string[];

  constructor(source: string, issues: ZodError["issues"]) {
    const problems = issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.map(String).join(".") : "(root)";
      return `${path}: ${issue.message}`;
    });
    super(`Invalid ${source} config:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ConfigError";
    this.problems = problems;
  }
}
