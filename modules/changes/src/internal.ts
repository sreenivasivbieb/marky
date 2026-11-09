/**
 * Engine ke andar ke shared helpers. Package ke bahar export nahi hote.
 */
import type { Actor, AuditAction, AuditTargetType, BlockType, DB } from "@marky/db";
import { blockContentSchema, prepareBlock, type BlockContent } from "@marky/documents";
import type { Transaction } from "kysely";
import { z } from "zod";
import { ChangeEngineError } from "./errors.ts";

export type Tx = Transaction<DB>;

export interface LockedDocument {
  id: string;
  product_id: string;
  title: string;
  state: "draft" | "in_review" | "final";
  current_version: number;
}

export interface LiveBlock {
  id: string;
  position: string;
  type: BlockType;
  content: BlockContent;
  hash: string;
}

/**
 * Version snapshot ka shape (versions.snapshot).
 * `type` hai, `interface` nahi: interface me implicit index signature nahi hota, to wo DB ke JSON type
 * (`{ [key: string]: JsonValue }`) me assign nahi hota.
 */
export type DocumentSnapshot = {
  title: string;
  blocks: { id: string; position: string; type: BlockType; content: BlockContent }[];
};

/**
 * Document row LOCK karo (`SELECT … FOR UPDATE`). Isi document par doosri accept transaction tab tak ruki rahegi jab tak
 * ye commit na ho. Isse do accepts ek hi version number nahi le sakte.
 * RLS: FOR UPDATE ko UPDATE policy bhi pass karni padti hai, to non-owner ko document "nahi milta".
 */
export async function lockDocument(trx: Tx, documentId: string): Promise<LockedDocument> {
  const doc = await trx
    .selectFrom("documents")
    .select(["id", "product_id", "title", "state", "current_version"])
    .where("id", "=", documentId)
    .forUpdate()
    .executeTakeFirst();
  if (!doc) throw new ChangeEngineError("document_not_found", `document ${documentId} not found`);
  return doc;
}

/** Bina lock ke padho (propose ke liye; propose kuch shared state nahi badalta). */
export async function readDocument(trx: Tx, documentId: string): Promise<LockedDocument> {
  const doc = await trx
    .selectFrom("documents")
    .select(["id", "product_id", "title", "state", "current_version"])
    .where("id", "=", documentId)
    .executeTakeFirst();
  if (!doc) throw new ChangeEngineError("document_not_found", `document ${documentId} not found`);
  return doc;
}

/** Final document me koi Change nahi (design doc section 3: reopen = naya version, approvals clear). */
export function assertEditable(doc: LockedDocument): void {
  if (doc.state === "final") {
    throw new ChangeEngineError("document_final", "document is final; reopen it before changing it");
  }
}

export async function liveBlocks(trx: Tx, documentId: string): Promise<LiveBlock[]> {
  const rows = await trx
    .selectFrom("blocks")
    .select(["id", "position", "type", "content", "hash"])
    .where("document_id", "=", documentId)
    .where("removed_at", "is", null)
    .orderBy("position")
    .execute();
  return rows.map((row) => ({ ...row, content: blockContentSchema.parse(row.content) }));
}

/** Anjaan content (AI / editor / snapshot) ko validate + normalise + hash karo; galat ho to invalid_input. */
export function prepareContent(input: unknown): { content: BlockContent; hash: string } {
  try {
    return prepareBlock(input);
  } catch (error) {
    const detail = error instanceof z.ZodError ? z.prettifyError(error) : String(error);
    throw new ChangeEngineError("invalid_input", `invalid block content:\n${detail}`);
  }
}

export function requireText(value: string, field: string): string {
  if (value.trim() === "") throw new ChangeEngineError("invalid_input", `${field} must not be empty`);
  return value;
}

export async function recordAudit(
  trx: Tx,
  actor: Actor,
  event: {
    productId: string;
    action: AuditAction;
    targetType: AuditTargetType;
    targetId: string;
    actorType?: "user" | "ai";
    metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  await trx
    .insertInto("audit_events")
    .values({
      product_id: event.productId,
      actor_type: event.actorType ?? "user",
      actor_id: actor.id,
      action: event.action,
      target_type: event.targetType,
      target_id: event.targetId,
      metadata: event.metadata ?? {},
    })
    .execute();
}

/**
 * Naya version: live blocks ka snapshot + documents.current_version badhao + audit.
 * Caller ne document LOCK kiya hona chahiye (lockDocument).
 */
export async function writeVersion(trx: Tx, actor: Actor, doc: LockedDocument): Promise<number> {
  const number = doc.current_version + 1;
  const blocks = await liveBlocks(trx, doc.id);
  const snapshot: DocumentSnapshot = {
    title: doc.title,
    blocks: blocks.map(({ id, position, type, content }) => ({ id, position, type, content })),
  };
  const version = await trx
    .insertInto("versions")
    .values({ document_id: doc.id, product_id: doc.product_id, number, snapshot, created_by: actor.id })
    .returning("id")
    .executeTakeFirstOrThrow();
  await trx.updateTable("documents").set({ current_version: number }).where("id", "=", doc.id).execute();
  await recordAudit(trx, actor, {
    productId: doc.product_id, action: "version.created", targetType: "version", targetId: version.id,
    metadata: { number },
  });
  return number;
}
