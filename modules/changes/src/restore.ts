/**
 * RESTORE (FR-20, D61): purane version ko wapas laane ke liye PENDING Changes ka set banao. History kabhi rewrite nahi hoti;
 * owner diff dekh kar sab (ya kuch) accept karta hai, aur tab naya version banta hai.
 *
 * Current live blocks vs snapshot (block id se milate hain; blocks soft-delete hote hain, isliye purane id abhi bhi hain):
 *   snapshot me hai + live hai + content alag  → edit
 *   live hai, snapshot me nahi                 → remove
 *   snapshot me hai, live nahi (removed)       → add (revive: same id), anchor = snapshot me pichhla block jo abhi live hai
 *
 * Order ka dhyan (accept `id` order me chalta hai = banne ka order):
 *   1. pehle removes, phir edits, phir revives;
 *   2. ek hi anchor ke baad aane wale revives ULTE order me bante hain: har ek "anchor ke theek baad" judta hai, to aakhri
 *      wala sabse pehle jaa kar neeche khisakta jaata hai, aur final order snapshot jaisa banta hai.
 * Limitation: MVP me "move" op nahi hai, isliye surviving blocks ka aapas ka order kabhi badalta hi nahi.
 */
import type { Actor } from "@marky/db";
import { blockContentSchema, hashBlockContent } from "@marky/documents";
import { z } from "zod";
import { ChangeEngineError } from "./errors.ts";
import { assertEditable, liveBlocks, readDocument, type Tx } from "./internal.ts";
import { insertChange } from "./propose.ts";

const snapshotSchema = z.object({
  title: z.string(),
  blocks: z.array(z.object({ id: z.string(), position: z.string(), type: z.string(), content: blockContentSchema })),
});

export function restoreReason(versionNumber: number): string {
  return `Restore to version ${versionNumber}`;
}

export async function proposeRestore(
  trx: Tx,
  actor: Actor,
  input: { documentId: string; versionNumber: number },
): Promise<string[]> {
  const doc = await readDocument(trx, input.documentId);
  assertEditable(doc);
  const version = await trx
    .selectFrom("versions")
    .select("snapshot")
    .where("document_id", "=", doc.id)
    .where("number", "=", input.versionNumber)
    .executeTakeFirst();
  if (!version) throw new ChangeEngineError("version_not_found", `version ${input.versionNumber} not found`);

  const snapshot = snapshotSchema.parse(version.snapshot);
  const live = await liveBlocks(trx, doc.id);
  const liveById = new Map(live.map((block) => [block.id, block]));
  const inSnapshot = new Set(snapshot.blocks.map((block) => block.id));
  const common = { reason: restoreReason(input.versionNumber), authorType: "user" as const };
  const extras = { restoreOfVersion: input.versionNumber };
  const created: string[] = [];

  // 1. removes
  for (const block of live) {
    if (inSnapshot.has(block.id)) continue;
    created.push(await insertChange(trx, actor, doc, { ...common, change: { op: "remove", blockId: block.id } }, extras));
  }

  // 2. edits
  for (const block of snapshot.blocks) {
    const current = liveById.get(block.id);
    if (!current || current.hash === hashBlockContent(block.content)) continue;
    created.push(await insertChange(trx, actor, doc,
      { ...common, change: { op: "edit", blockId: block.id, content: block.content } }, extras));
  }

  // 3. revives, anchor ke hisaab se groups me, har group ulte order me
  const groups = new Map<string | null, typeof snapshot.blocks>();
  let anchor: string | null = null;
  for (const block of snapshot.blocks) {
    if (liveById.has(block.id)) { anchor = block.id; continue; }
    const group = groups.get(anchor) ?? [];
    group.push(block);
    groups.set(anchor, group);
  }
  for (const [anchorBlockId, group] of groups) {
    for (const block of [...group].reverse()) {
      created.push(await insertChange(trx, actor, doc,
        { ...common, change: { op: "add", anchorBlockId, content: block.content } },
        { ...extras, reviveBlockId: block.id }));
    }
  }

  return created;
}
