/**
 * @marky/changes: change engine ka public API (ADR 0022, 0024).
 * Har function ek chal rahi transaction (`withActor` se) leta hai; khud transaction nahi kholta, taaki caller kai kaam
 * ek hi atomic unit me jod sake.
 */
export { acceptChanges, STALE_REASONS, type AcceptItem, type AcceptResult, type StaleReason } from "./accept.ts";
export { createDocument, type CreateDocumentInput } from "./create-document.ts";
export { CHANGE_ENGINE_ERROR_CODES, ChangeEngineError, type ChangeEngineErrorCode } from "./errors.ts";
export { HUMAN_EDIT_REASON, saveHumanEdit } from "./human-edit.ts";
export type { DocumentSnapshot } from "./internal.ts";
export { proposeChange, type ChangeSpec, type ProposeInput } from "./propose.ts";
export { rejectChange } from "./reject.ts";
export { proposeRestore, restoreReason } from "./restore.ts";
