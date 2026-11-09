/**
 * ACCEPT: product ka dil (design doc section 7, step 5). EK transaction me:
 *   1. document LOCK (doosre accepts ruk jaate hain)
 *   2. har Change: block ka current hash check → match ho to apply, warna STALE (D58 lazy re-check)
 *   3. apply hote hi usi block ke baaki pending Changes STALE (D58 eager)
 *   4. kuch bhi apply hua to EK naya version (D60) + audit + decisions (FR-14)
 * Koi bhi step fail ho to caller ki transaction rollback hoti hai: "if either fails, neither is saved".
 * Bulk me kuch stale hon to baaki apply hote hain, stale result me alag aate hain (D63).
 */
import type { Actor } from "@marky/db";
import { keyBetween, type BlockContent } from "@marky/documents";
import { sql } from "kysely";
import { ChangeEngineError } from "./errors.ts";
import {
  assertEditable,
  lockDocument,
  prepareContent,
  recordAudit,
  requireText,
  writeVersion,
  type LockedDocument,
  type Tx,
} from "./internal.ts";

export interface AcceptItem {
  changeId: string;
  /** Edit-then-accept (FR-12, D62): owner ka badla hua content. Sirf add/edit ke liye. */
  acceptedContent?: unknown;
  /** "Mark as decision" (FR-14): reason required. */
  decision?: { summary: string; reason: string };
}

export const STALE_REASONS = ["block_changed", "block_removed", "anchor_removed", "block_already_live", "already_stale"] as const;
export type StaleReason = (typeof STALE_REASONS)[number];

export interface AcceptResult {
  /** Naya version number, ya null agar kuch apply nahi hua. */
  version: number | null;
  accepted: string[];
  stale: { changeId: string; reason: StaleReason }[];
  decisions: string[];
}

type ChangeRow = {
  id: string;
  op: "add" | "edit" | "remove";
  status: "pending" | "accepted" | "rejected" | "stale";
  block_id: string | null;
  anchor_block_id: string | null;
  before_hash: string | null;
  after: unknown;
  author_type: "ai" | "user";
};

type Prepared = { content: BlockContent; hash: string };

type ApplyOutcome = { ok: true; blockId: string } | { ok: false; reason: StaleReason };

function validateItems(items: readonly AcceptItem[]): void {
  if (items.length === 0) throw new ChangeEngineError("invalid_input", "nothing to accept");
  const ids = new Set(items.map((i) => i.changeId));
  if (ids.size !== items.length) throw new ChangeEngineError("invalid_input", "duplicate change ids");
  for (const item of items) {
    if (item.decision) {
      requireText(item.decision.summary, "decision summary");
      requireText(item.decision.reason, "decision reason");
    }
  }
}

async function blockState(trx: Tx, doc: LockedDocument, blockId: string) {
  return trx
    .selectFrom("blocks")
    .select(["id", "position", "hash", "removed_at"])
    .where("id", "=", blockId)
    .where("document_id", "=", doc.id)
    .executeTakeFirst();
}

/** Anchor ke baad wale pehle live block se pehle ki position (anchor null = shuruaat). */
async function positionAfter(trx: Tx, doc: LockedDocument, anchorPosition: string | null): Promise<string> {
  let query = trx
    .selectFrom("blocks")
    .select("position")
    .where("document_id", "=", doc.id)
    .where("removed_at", "is", null)
    .orderBy("position")
    .limit(1);
  if (anchorPosition !== null) query = query.where("position", ">", anchorPosition);
  const next = await query.executeTakeFirst();
  return keyBetween(anchorPosition, next?.position ?? null);
}

async function applyChange(
  trx: Tx,
  doc: LockedDocument,
  change: ChangeRow,
  edited: Prepared | null,
): Promise<ApplyOutcome> {
  if (change.op === "add") {
    let anchorPosition: string | null = null;
    if (change.anchor_block_id !== null) {
      const anchor = await blockState(trx, doc, change.anchor_block_id);
      if (!anchor || anchor.removed_at !== null) return { ok: false, reason: "anchor_removed" };
      anchorPosition = anchor.position;
    }
    const position = await positionAfter(trx, doc, anchorPosition);
    const blockContent = edited ?? prepareContent(change.after);

    if (change.block_id !== null) {
      // Restore revive (D61): wahi purana block wapas, same id (comments/history jude rehte hain).
      const target = await blockState(trx, doc, change.block_id);
      if (!target) throw new ChangeEngineError("block_not_found", `block ${change.block_id} not found`);
      if (target.removed_at === null) return { ok: false, reason: "block_already_live" };
      await trx.updateTable("blocks").set({
        position, type: blockContent.content.type, content: blockContent.content, hash: blockContent.hash,
        removed_at: null, updated_at: sql`now()`,
      }).where("id", "=", change.block_id).execute();
      return { ok: true, blockId: change.block_id };
    }

    const inserted = await trx.insertInto("blocks").values({
      document_id: doc.id, product_id: doc.product_id, position,
      type: blockContent.content.type, content: blockContent.content, hash: blockContent.hash,
    }).returning("id").executeTakeFirstOrThrow();
    return { ok: true, blockId: inserted.id };
  }

  // edit / remove: block abhi bhi wahi hai jo proposal ke waqt tha? (hash = "fingerprint")
  const blockId = change.block_id ?? "";
  const block = await blockState(trx, doc, blockId);
  if (!block || block.removed_at !== null) return { ok: false, reason: "block_removed" };
  if (block.hash !== change.before_hash) return { ok: false, reason: "block_changed" };

  if (change.op === "remove") {
    await trx.updateTable("blocks").set({ removed_at: sql`now()`, updated_at: sql`now()` })
      .where("id", "=", blockId).execute();
  } else {
    const prepared = edited ?? prepareContent(change.after);
    await trx.updateTable("blocks").set({
      type: prepared.content.type, content: prepared.content, hash: prepared.hash, updated_at: sql`now()`,
    }).where("id", "=", blockId).execute();
  }
  return { ok: true, blockId };
}

/**
 * Eager stale (D58): jo block abhi badla, uspar baaki sab pending Changes ab purane content par based hain.
 * Remove hua to us block ke baad "add" karne wale pending Changes bhi stale.
 */
async function markDependentsStale(
  trx: Tx,
  doc: LockedDocument,
  change: ChangeRow,
  blockId: string,
): Promise<{ changeId: string; reason: StaleReason }[]> {
  if (change.op === "add" && change.block_id === null) return []; // naya block: uspar koi pending change ho hi nahi sakta
  const stale: { changeId: string; reason: StaleReason }[] = [];

  const sameBlock = await trx.updateTable("changes").set({ status: "stale" })
    .where("document_id", "=", doc.id).where("status", "=", "pending")
    .where("block_id", "=", blockId).where("id", "<>", change.id)
    .returning("id").execute();
  stale.push(...sameBlock.map((r) => ({
    changeId: r.id, reason: (change.op === "remove" ? "block_removed" : "block_changed") as StaleReason,
  })));

  if (change.op === "remove") {
    const anchored = await trx.updateTable("changes").set({ status: "stale" })
      .where("document_id", "=", doc.id).where("status", "=", "pending")
      .where("anchor_block_id", "=", blockId)
      .returning("id").execute();
    stale.push(...anchored.map((r) => ({ changeId: r.id, reason: "anchor_removed" as StaleReason })));
  }
  return stale;
}

export async function acceptChanges(
  trx: Tx,
  actor: Actor,
  input: { documentId: string; items: readonly AcceptItem[] },
): Promise<AcceptResult> {
  validateItems(input.items);
  const doc = await lockDocument(trx, input.documentId);
  assertEditable(doc);

  const itemById = new Map(input.items.map((item) => [item.changeId, item]));
  const rows: ChangeRow[] = await trx
    .selectFrom("changes")
    .select(["id", "op", "status", "block_id", "anchor_block_id", "before_hash", "after", "author_type"])
    .where("document_id", "=", doc.id)
    .where("id", "in", [...itemById.keys()])
    .orderBy("id") // uuidv7 = banne ka order; restore batches isi order par depend karte hain
    .forUpdate()
    .execute();
  if (rows.length !== itemById.size) {
    throw new ChangeEngineError("change_not_found", "one or more changes not found in this document");
  }

  // Sab input pehle check: accepted/rejected ko dobara accept karna client ka bug hai.
  const preparedContent = new Map<string, Prepared>();
  for (const row of rows) {
    if (row.status === "accepted" || row.status === "rejected") {
      throw new ChangeEngineError("change_not_pending", `change ${row.id} is already ${row.status}`);
    }
    const item = itemById.get(row.id);
    if (item?.acceptedContent !== undefined) {
      if (row.op === "remove") throw new ChangeEngineError("invalid_input", "a remove cannot be edited before accepting");
      preparedContent.set(row.id, prepareContent(item.acceptedContent));
    }
  }

  const versionNumber = doc.current_version + 1;
  const accepted: string[] = [];
  const stale = new Map<string, StaleReason>();

  for (const row of rows) {
    if (row.status === "stale") { stale.set(row.id, "already_stale"); continue; }
    if (stale.has(row.id)) continue; // isi batch me pehle wale Change ne ise stale kar diya

    const edited = preparedContent.get(row.id) ?? null;
    const outcome = await applyChange(trx, doc, row, edited);
    if (!outcome.ok) {
      stale.set(row.id, outcome.reason);
      await trx.updateTable("changes").set({ status: "stale" }).where("id", "=", row.id).execute();
      continue;
    }

    await trx.updateTable("changes").set({
      status: "accepted",
      block_id: outcome.blockId,
      resulting_version: versionNumber,
      decided_by: actor.id,
      decided_at: sql`now()`,
      accepted_after: edited ? edited.content : null,
    }).where("id", "=", row.id).execute();
    accepted.push(row.id);

    for (const dependent of await markDependentsStale(trx, doc, row, outcome.blockId)) {
      stale.set(dependent.changeId, dependent.reason);
    }
  }

  const staleList = [...stale].map(([changeId, reason]) => ({ changeId, reason }));
  for (const { changeId, reason } of staleList) {
    if (reason === "already_stale") continue;
    await recordAudit(trx, actor, {
      productId: doc.product_id, action: "change.stale", targetType: "change", targetId: changeId, metadata: { reason },
    });
  }
  if (accepted.length === 0) return { version: null, accepted, stale: staleList, decisions: [] };

  const version = await writeVersion(trx, actor, doc);
  for (const changeId of accepted) {
    await recordAudit(trx, actor, {
      productId: doc.product_id, action: "change.accepted", targetType: "change", targetId: changeId,
      metadata: { version, edited: preparedContent.has(changeId) },
    });
  }

  // Decisions sirf un Changes ke jo sach me apply hue (stale ka decision nahi banta).
  const decisions: string[] = [];
  for (const changeId of accepted) {
    const decision = itemById.get(changeId)?.decision;
    if (!decision) continue;
    const row = await trx.insertInto("decisions").values({
      product_id: doc.product_id, document_id: doc.id, change_id: changeId, version_number: version,
      summary: decision.summary, reason: decision.reason, created_by: actor.id,
    }).returning("id").executeTakeFirstOrThrow();
    decisions.push(row.id);
    await recordAudit(trx, actor, {
      productId: doc.product_id, action: "decision.recorded", targetType: "decision", targetId: row.id,
      metadata: { changeId, version },
    });
  }

  return { version, accepted, stale: staleList, decisions };
}
