/**
 * HUMAN EDIT (D56): owner ka apna edit bhi ek Change hai, jo usi transaction me turant accept hota hai.
 * Isse insaan aur AI dono ke edits ki history, versions aur restore ek hi pipeline se chalte hain.
 * Debounce (kitni der baad save karein) editor ka kaam hai; yahan ek call = ek saved edit = ek version.
 */
import type { Actor } from "@marky/db";
import { acceptChanges, type AcceptResult } from "./accept.ts";
import { assertEditable, lockDocument, type Tx } from "./internal.ts";
import { insertChange, type ChangeSpec } from "./propose.ts";

/** Product language me reason (design doc section 9: "Product language"). */
export const HUMAN_EDIT_REASON = "Edited by owner";

export async function saveHumanEdit(
  trx: Tx,
  actor: Actor,
  input: { documentId: string; change: ChangeSpec },
): Promise<AcceptResult> {
  // Pehle hi lock: propose aur accept ke beech koi aur accept ghus na sake.
  const doc = await lockDocument(trx, input.documentId);
  assertEditable(doc);
  const changeId = await insertChange(trx, actor, doc, {
    change: input.change, reason: HUMAN_EDIT_REASON, authorType: "user",
  });
  return acceptChanges(trx, actor, { documentId: doc.id, items: [{ changeId }] });
}
