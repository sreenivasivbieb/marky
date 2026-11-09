/**
 * PROPOSE: ek pending Change banana (AI ka `propose_change` tool, ya insaan ka edit jo turant accept hoga).
 * Document ko kabhi seedha nahi badalta (FR-08). Sirf `changes` me ek row + audit.
 */
import type { Actor, ChangeAuthorType } from "@marky/db";
import { ChangeEngineError } from "./errors.ts";
import {
  assertEditable,
  prepareContent,
  readDocument,
  recordAudit,
  requireText,
  type LockedDocument,
  type Tx,
} from "./internal.ts";

/** Kya badalna hai. `add` ka `anchorBlockId` = "is block ke baad" (null = shuruaat). */
export type ChangeSpec =
  | { op: "edit"; blockId: string; content: unknown }
  | { op: "remove"; blockId: string }
  | { op: "add"; anchorBlockId: string | null; content: unknown };

export interface ProposeInput {
  documentId: string;
  change: ChangeSpec;
  reason: string;
  authorType: ChangeAuthorType;
}

/** Restore (D61) bhi isi raste se jaata hai, do extra fields ke saath. */
export interface InsertChangeExtras {
  restoreOfVersion?: number;
  /** Restore: removed block ko wapas laana (same id). Sirf `add` ke saath. */
  reviveBlockId?: string;
}

async function findBlock(trx: Tx, documentId: string, blockId: string) {
  const block = await trx
    .selectFrom("blocks")
    .select(["id", "content", "hash", "removed_at"])
    .where("id", "=", blockId)
    .where("document_id", "=", documentId)
    .executeTakeFirst();
  return block;
}

async function requireLiveBlock(trx: Tx, documentId: string, blockId: string) {
  const block = await findBlock(trx, documentId, blockId);
  if (!block || block.removed_at !== null) {
    throw new ChangeEngineError("block_not_found", `block ${blockId} not found in document ${documentId}`);
  }
  return block;
}

export async function insertChange(
  trx: Tx,
  actor: Actor,
  doc: LockedDocument,
  input: Omit<ProposeInput, "documentId">,
  extras: InsertChangeExtras = {},
): Promise<string> {
  requireText(input.reason, "reason");
  const base = {
    document_id: doc.id,
    product_id: doc.product_id,
    reason: input.reason,
    author_type: input.authorType,
    author_id: actor.id,
    base_version: doc.current_version,
    restore_of_version: extras.restoreOfVersion ?? null,
  };

  let values;
  const spec = input.change;
  if (spec.op === "add") {
    if (spec.anchorBlockId !== null) await requireLiveBlock(trx, doc.id, spec.anchorBlockId);
    values = {
      ...base, op: "add" as const,
      anchor_block_id: spec.anchorBlockId,
      block_id: extras.reviveBlockId ?? null,
      after: prepareContent(spec.content).content,
    };
  } else {
    const block = await requireLiveBlock(trx, doc.id, spec.blockId);
    values = {
      ...base, op: spec.op, block_id: block.id, before: block.content, before_hash: block.hash,
      after: spec.op === "edit" ? prepareContent(spec.content).content : null,
    };
  }

  const change = await trx.insertInto("changes").values(values).returning("id").executeTakeFirstOrThrow();
  await recordAudit(trx, actor, {
    productId: doc.product_id, action: "change.proposed", targetType: "change", targetId: change.id,
    actorType: input.authorType, metadata: { op: spec.op, restoreOfVersion: extras.restoreOfVersion ?? null },
  });
  return change.id;
}

export async function proposeChange(trx: Tx, actor: Actor, input: ProposeInput): Promise<string> {
  const doc = await readDocument(trx, input.documentId);
  assertEditable(doc);
  return insertChange(trx, actor, doc, input);
}
