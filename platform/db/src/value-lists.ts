/**
 * ALLOWED-VALUE LISTS: DB ke `CHECK (column IN (...))` constraints ka TypeScript mirror (ADR 0021).
 *
 * Asli rule DB migration me hai; ye uski TS copy hai, taaki galat value (`role: "admin"`) compile time par hi pakdi jaaye.
 * Do jagah same list = "drift" ka khatra (ek badlo, doosri bhool jao). Isliye `value-lists.test.ts`:
 *   - DB ke har value-list CHECK constraint ko yahan ki list se milata hai,
 *   - aisa naya constraint jiski list yahan nahi hai, use bhi pakadta hai,
 *   - aur check karta hai ki codegen config me har list ka override hai.
 *
 * Naya text+CHECK column banao to: (1) migration, (2) yahan list + `VALUE_LISTS` entry, (3) `.kysely-codegenrc.json`
 * me override + import, (4) `db:types` regenerate.
 */

/** memberships.role: product me user ka role (design doc section 11). */
export const MEMBERSHIP_ROLES = ["owner", "reviewer", "viewer"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

/** products.plan: pricing plan. Abhi sirf "free"; baaki pricing tay hone par (ADR 0019). */
export const PRODUCT_PLANS = ["free"] as const;
export type ProductPlan = (typeof PRODUCT_PLANS)[number];

/** documents.state: Draft → In review → Final (design doc section 3). */
export const DOCUMENT_STATES = ["draft", "in_review", "final"] as const;
export type DocumentState = (typeof DOCUMENT_STATES)[number];

/** blocks.type: MVP ke block types (FR-03, D53). Content ka shape modules/documents me Zod schema se. */
export const BLOCK_TYPES = [
  "heading",
  "paragraph",
  "bullet_item",
  "numbered_item",
  "checklist_item",
  "table",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/** changes.op */
export const CHANGE_OPS = ["add", "edit", "remove"] as const;
export type ChangeOp = (typeof CHANGE_OPS)[number];

/** changes.status (design doc section 8) */
export const CHANGE_STATUSES = ["pending", "accepted", "rejected", "stale"] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

/** changes.author_type: AI ne propose kiya ya insaan ne khud edit kiya (D56) */
export const CHANGE_AUTHOR_TYPES = ["ai", "user"] as const;
export type ChangeAuthorType = (typeof CHANGE_AUTHOR_TYPES)[number];

/** decisions.status (design doc section 3 "Decision lifecycle") */
export const DECISION_STATUSES = ["active", "superseded"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

/** audit_events.actor_type */
export const AUDIT_ACTOR_TYPES = ["user", "ai", "guest", "system"] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

/** audit_events.action: naya action jodna = migration + yahan (drift test yaad dilayega). */
export const AUDIT_ACTIONS = [
  "document.created",
  "change.proposed",
  "change.accepted",
  "change.rejected",
  "change.stale",
  "version.created",
  "decision.recorded",
  "ai_credential.set",
  "ai_credential.removed",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** audit_events.target_type */
export const AUDIT_TARGET_TYPES = ["document", "change", "version", "decision", "ai_credential"] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

/** AI providers jinke native adapters hain (ADR 0027). Naya provider = migration + yahan + adapter. */
export const AI_PROVIDERS = ["anthropic", "openai", "google"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** ai_requests.purpose: model call kis kaam ke liye hua */
export const AI_REQUEST_PURPOSES = ["chat", "summary", "connection_test"] as const;
export type AiRequestPurpose = (typeof AI_REQUEST_PURPOSES)[number];

/** ai_requests.status */
export const AI_REQUEST_STATUSES = ["succeeded", "failed", "refused"] as const;
export type AiRequestStatus = (typeof AI_REQUEST_STATUSES)[number];

/** chat_turns.role */
export const CHAT_ROLES = ["user", "assistant"] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

/** chat_turns.mode: design doc section 3 (Draft / Align / Ship) */
export const AI_MODES = ["draft", "align", "ship"] as const;
export type AiMode = (typeof AI_MODES)[number];

/** Registry: "table.column" → allowed values. Drift test isi ko DB se milata hai. */
export const VALUE_LISTS = {
  "memberships.role": MEMBERSHIP_ROLES,
  "products.plan": PRODUCT_PLANS,
  "documents.state": DOCUMENT_STATES,
  "blocks.type": BLOCK_TYPES,
  "changes.op": CHANGE_OPS,
  "changes.status": CHANGE_STATUSES,
  "changes.author_type": CHANGE_AUTHOR_TYPES,
  "decisions.status": DECISION_STATUSES,
  "audit_events.actor_type": AUDIT_ACTOR_TYPES,
  "audit_events.action": AUDIT_ACTIONS,
  "audit_events.target_type": AUDIT_TARGET_TYPES,
  "ai_credentials.provider": AI_PROVIDERS,
  "ai_requests.provider": AI_PROVIDERS,
  "ai_requests.purpose": AI_REQUEST_PURPOSES,
  "ai_requests.status": AI_REQUEST_STATUSES,
  "chat_turns.role": CHAT_ROLES,
  "chat_turns.mode": AI_MODES,
} as const satisfies Record<string, readonly string[]>;
