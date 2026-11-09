import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canonicalJson, hashBlockContent, prepareBlock } from "./hash.ts";
import { normalizeBlock, normalizeRuns, runsText } from "./normalize.ts";
import { blockContentSchema, TEXT_MARKS, type BlockContent, type Run } from "./schema.ts";

// ---------- Example tests: schema ----------

describe("blockContentSchema", () => {
  it("valid blocks accept karta hai", () => {
    const valid: unknown[] = [
      { type: "heading", level: 2, runs: [{ text: "Goals" }] },
      { type: "paragraph", runs: [{ text: "Ship", marks: ["bold"] }, { text: " in Q1" }] },
      { type: "checklist_item", depth: 0, checked: false, runs: [] },
      { type: "paragraph", runs: [{ text: "docs", link: "https://example.com/spec" }] },
      { type: "table", hasHeaderRow: true, rows: [[{ runs: [{ text: "A" }] }, { runs: [] }]] },
    ];
    for (const block of valid) expect(() => blockContentSchema.parse(block)).not.toThrow();
  });

  it("anjaan field reject karta hai (AI ka galat key chupchaap ignore nahi hota)", () => {
    expect(() => blockContentSchema.parse({ type: "paragraph", runs: [], colour: "red" })).toThrow();
  });

  it("javascript: link reject karta hai (XSS se bachav)", () => {
    expect(() =>
      blockContentSchema.parse({ type: "paragraph", runs: [{ text: "x", link: "javascript:alert(1)" }] }),
    ).toThrow();
  });

  it("heading level 4 aur list depth limit se bahar reject", () => {
    expect(() => blockContentSchema.parse({ type: "heading", level: 4, runs: [] })).toThrow();
    expect(() => blockContentSchema.parse({ type: "bullet_item", depth: 99, runs: [] })).toThrow();
  });

  it("table ki har row me barabar cells", () => {
    expect(() =>
      blockContentSchema.parse({
        type: "table", hasHeaderRow: false,
        rows: [[{ runs: [] }, { runs: [] }], [{ runs: [] }]],
      }),
    ).toThrow(/same number of cells/);
  });
});

// ---------- Property tests: normalise + hash ----------

const runArb: fc.Arbitrary<Run> = fc.record(
  {
    text: fc.string({ maxLength: 6 }),
    marks: fc.array(fc.constantFrom(...TEXT_MARKS), { maxLength: 4 }), // duplicates + random order bhi
    link: fc.constantFrom("https://a.example/x", "mailto:pm@example.test"),
  },
  { requiredKeys: ["text"] },
);
const runsArb = fc.array(runArb, { maxLength: 8 });

/** Har character ki formatting nikaalo: ["S|bold|", "h|bold|", …]. Normalisation ke baad ye bilkul same rehni chahiye. */
function perCharacter(runs: readonly Run[]): string[] {
  return runs.flatMap((run) => {
    const marks = [...new Set(run.marks ?? [])].sort().join(",");
    return [...run.text].map((ch) => `${ch}|${marks}|${run.link ?? ""}`);
  });
}

describe("normalizeRuns (property tests)", () => {
  it("idempotent: normalise(normalise(x)) == normalise(x)", () => {
    fc.assert(fc.property(runsArb, (runs) => {
      const once = normalizeRuns(runs);
      expect(normalizeRuns(once)).toEqual(once);
    }));
  });

  it("text kabhi nahi badalta", () => {
    fc.assert(fc.property(runsArb, (runs) => {
      expect(runsText(normalizeRuns(runs))).toBe(runsText(runs));
    }));
  });

  it("har character ki formatting same rehti hai", () => {
    fc.assert(fc.property(runsArb, (runs) => {
      expect(perCharacter(normalizeRuns(runs))).toEqual(perCharacter(runs));
    }));
  });

  it("result me na khaali runs, na same-formatting wale bagal ke runs", () => {
    fc.assert(fc.property(runsArb, (runs) => {
      const out = normalizeRuns(runs);
      for (const [i, run] of out.entries()) {
        expect(run.text).not.toBe("");
        const next = out[i + 1];
        if (next) {
          const same = (run.marks ?? []).join() === (next.marks ?? []).join() && run.link === next.link;
          expect(same).toBe(false);
        }
      }
    }));
  });

  it("input ko mutate nahi karta", () => {
    fc.assert(fc.property(runsArb, (runs) => {
      const copy = structuredClone(runs);
      normalizeRuns(runs);
      expect(runs).toEqual(copy);
    }));
  });
});

describe("hashBlockContent", () => {
  const paragraph = (runs: Run[]): BlockContent => ({ type: "paragraph", runs });

  it("property: ek run ko kahin bhi todo, hash same rehta hai", () => {
    fc.assert(fc.property(runArb, fc.nat(), (run, cut) => {
      const at = run.text.length === 0 ? 0 : cut % (run.text.length + 1);
      const split: Run[] = [{ ...run, text: run.text.slice(0, at) }, { ...run, text: run.text.slice(at) }];
      expect(hashBlockContent(paragraph(split))).toBe(hashBlockContent(paragraph([run])));
    }));
  });

  it("property: marks ka order/duplicates hash nahi badalte", () => {
    fc.assert(fc.property(fc.array(fc.constantFrom(...TEXT_MARKS), { minLength: 1, maxLength: 4 }), (marks) => {
      const shuffled = [...marks].reverse().concat(marks);
      expect(hashBlockContent(paragraph([{ text: "x", marks: shuffled }])))
        .toBe(hashBlockContent(paragraph([{ text: "x", marks }])));
    }));
  });

  it("text, formatting ya block type badle to hash badalta hai", () => {
    const base = hashBlockContent(paragraph([{ text: "Ship in Q1" }]));
    expect(hashBlockContent(paragraph([{ text: "Ship in Q2" }]))).not.toBe(base);
    expect(hashBlockContent(paragraph([{ text: "Ship in Q1", marks: ["bold"] }]))).not.toBe(base);
    expect(hashBlockContent({ type: "heading", level: 1, runs: [{ text: "Ship in Q1" }] })).not.toBe(base);
  });

  it("hash 64 hex characters (DB CHECK format)", () => {
    expect(hashBlockContent(paragraph([]))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("canonicalJson", () => {
  it("object keys ka order matter nahi karta, array ka karta hai", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});

describe("prepareBlock", () => {
  it("validate + normalise + hash ek saath", () => {
    const { content, hash } = prepareBlock({ type: "paragraph", runs: [{ text: "Sh" }, { text: "" }, { text: "ip" }] });
    expect(content).toEqual({ type: "paragraph", runs: [{ text: "Ship" }] });
    expect(hash).toBe(hashBlockContent({ type: "paragraph", runs: [{ text: "Ship" }] }));
  });

  it("galat input par error, DB tak kuch nahi pahunchta", () => {
    expect(() => prepareBlock({ type: "video", url: "x" })).toThrow();
  });

  it("normalizeBlock table cells ko bhi normalise karta hai", () => {
    const table = normalizeBlock({
      type: "table", hasHeaderRow: false, rows: [[{ runs: [{ text: "a" }, { text: "b" }] }]],
    });
    expect(table).toEqual({ type: "table", hasHeaderRow: false, rows: [[{ runs: [{ text: "ab" }] }]] });
  });
});
