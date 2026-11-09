/**
 * NORMALISATION: ek hi content ke kai likhne ke tareeke ko ek "canonical" roop me laana.
 *
 * Problem: [{text:"Sh"},{text:"ip"}] aur [{text:"Ship"}] dikhte bilkul same hain, par JSON alag hai, to hash alag hota.
 * Tab engine galti se maanta ki block badal gaya, aur pending AI change bina wajah "stale" ho jaata.
 *
 * Rules (sab runs par):
 *   1. Khaali text wale runs hatao.
 *   2. marks ko fixed order me rakho, duplicates hatao; khaali marks array = field hi nahi.
 *   3. Bagal ke do runs jinki formatting (marks + link) same hai, unhe jod do.
 * Normalise ek baar karo ya das baar, result same rehta hai (idempotent; property test isse check karta hai).
 */
import { TEXT_MARKS, type BlockContent, type Run, type TextMark } from "./schema.ts";

const MARK_ORDER = new Map<TextMark, number>(TEXT_MARKS.map((mark, index) => [mark, index]));

function normalizeMarks(marks: readonly TextMark[] | undefined): TextMark[] | undefined {
  if (!marks || marks.length === 0) return undefined;
  const unique = [...new Set(marks)];
  unique.sort((a, b) => (MARK_ORDER.get(a) ?? 0) - (MARK_ORDER.get(b) ?? 0));
  return unique;
}

/** Do runs ki formatting same hai? (text ke alawa sab kuch) */
function sameFormatting(a: Run, b: Run): boolean {
  return a.link === b.link && (a.marks ?? []).join(",") === (b.marks ?? []).join(",");
}

/** Run object banao jisme sirf maujood fields hon (`exactOptionalPropertyTypes` ke saath `undefined` likhna mana hai). */
function makeRun(text: string, marks: TextMark[] | undefined, link: string | undefined): Run {
  const run: Run = { text };
  if (marks) run.marks = marks;
  if (link !== undefined) run.link = link;
  return run;
}

export function normalizeRuns(runs: readonly Run[]): Run[] {
  const result: Run[] = [];
  for (const run of runs) {
    if (run.text === "") continue;
    const current = makeRun(run.text, normalizeMarks(run.marks), run.link);
    const previous = result.at(-1);
    if (previous && sameFormatting(previous, current)) {
      previous.text += current.text;
    } else {
      result.push(current);
    }
  }
  return result;
}

/** Poore block ko normalise karo. Naya object lautata hai; input ko nahi badalta. */
export function normalizeBlock(block: BlockContent): BlockContent {
  if (block.type === "table") {
    return {
      ...block,
      rows: block.rows.map((row) => row.map((cell) => ({ runs: normalizeRuns(cell.runs) }))),
    };
  }
  return { ...block, runs: normalizeRuns(block.runs) };
}

/** Runs ka plain text (formatting hata kar). AI context, search aur tests ke liye. */
export function runsText(runs: readonly Run[]): string {
  return runs.map((run) => run.text).join("");
}
