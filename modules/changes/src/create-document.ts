/**
 * Naya document: blocks + version 1, ek transaction me.
 * Shuruaati content (template ya khaali) Changes ke bina seedha likha jaata hai; ye document ki "janam" state hai.
 */
import type { Actor } from "@marky/db";
import { keysBetween } from "@marky/documents";
import { prepareContent, recordAudit, requireText, writeVersion, type Tx } from "./internal.ts";

export interface CreateDocumentInput {
  productId: string;
  title: string;
  /** Shuruaati blocks (anjaan input; validate hote hain). Khaali array = khaali document. */
  blocks: readonly unknown[];
}

export async function createDocument(
  trx: Tx,
  actor: Actor,
  input: CreateDocumentInput,
): Promise<{ documentId: string; version: number }> {
  requireText(input.title, "title");
  const prepared = input.blocks.map(prepareContent); // DB chhoone se pehle saara input check

  const doc = await trx
    .insertInto("documents")
    .values({ product_id: input.productId, title: input.title, created_by: actor.id })
    .returning(["id", "product_id", "title", "state", "current_version"])
    .executeTakeFirstOrThrow();

  if (prepared.length > 0) {
    const positions = keysBetween(null, null, prepared.length);
    await trx
      .insertInto("blocks")
      .values(prepared.map(({ content, hash }, i) => ({
        document_id: doc.id,
        product_id: doc.product_id,
        position: positions[i] ?? "",
        type: content.type,
        content,
        hash,
      })))
      .execute();
  }

  await recordAudit(trx, actor, {
    productId: doc.product_id, action: "document.created", targetType: "document", targetId: doc.id,
  });
  const version = await writeVersion(trx, actor, doc);
  return { documentId: doc.id, version };
}
