/**
 * @marky/documents: public API. Doosre packages sirf yahan se import karein.
 */
export { canonicalJson, hashBlockContent, prepareBlock } from "./blocks/hash.ts";
export { normalizeBlock, normalizeRuns, runsText } from "./blocks/normalize.ts";
export {
  ALLOWED_LINK_PROTOCOLS,
  blockContentSchema,
  HEADING_LEVELS,
  MAX_LIST_DEPTH,
  runSchema,
  TEXT_MARKS,
  type BlockContent,
  type Run,
  type TextMark,
} from "./blocks/schema.ts";
export { comparePositions, keyBetween, keysBetween } from "./positions.ts";
