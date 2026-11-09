/**
 * REJECT (FR-12): pending ya stale Change ko band karo, optional note ke saath. Document nahi badalta, version nahi banta.
 * Stale ko reject karna = "is purane proposal ko hata do" (UI ka dismiss).
 */
import type { Actor } from "@marky/db";
import { sql } from "kysely";
import { ChangeEngineError } from "./errors.ts";
import { recordAudit, type Tx } from "./internal.ts";

export async function rejectChange(
  trx: Tx,
  actor: Actor,
  input: { changeId: string; note?: string },
): Promise<void> {
  const change = await trx
    .selectFrom("changes")
    .select(["id", "product_id", "status"])
    .where("id", "=", input.changeId)
    .forUpdate()
    .executeTakeFirst();
  if (!change) throw new ChangeEngineError("change_not_found", `change ${input.changeId} not found`);
  if (change.status !== "pending" && change.status !== "stale") {
    throw new ChangeEngineError("change_not_pending", `change ${change.id} is already ${change.status}`);
  }

  const note = input.note?.trim() ? input.note : null;
  await trx.updateTable("changes").set({
    status: "rejected", decided_by: actor.id, decided_at: sql`now()`, decision_note: note,
  }).where("id", "=", change.id).execute();
  await recordAudit(trx, actor, {
    productId: change.product_id, action: "change.rejected", targetType: "change", targetId: change.id,
    metadata: { hadNote: note !== null },
  });
}
