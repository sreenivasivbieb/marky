/**
 * Change engine ke "expected" errors. Har ek ka code hota hai, taaki API layer use HTTP status / UI message me badal sake
 * (jaise document_final → "This document is final. Reopen it to make changes.").
 */
export const CHANGE_ENGINE_ERROR_CODES = [
  "invalid_input",
  "document_not_found",
  "document_final",
  "block_not_found",
  "change_not_found",
  "change_not_pending",
  "version_not_found",
] as const;
export type ChangeEngineErrorCode = (typeof CHANGE_ENGINE_ERROR_CODES)[number];

export class ChangeEngineError extends Error {
  readonly code: ChangeEngineErrorCode;

  constructor(code: ChangeEngineErrorCode, message: string) {
    super(message);
    this.name = "ChangeEngineError";
    this.code = code;
  }
}
