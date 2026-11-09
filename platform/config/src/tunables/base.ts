/**
 * BASE TUNABLES: har environment ke default values.
 *
 * Har value ke saath likha hai ki wo design doc (docs/design/pm-workspace-design.md) me kahan se aayi.
 * Value badalni ho to yahan badlo. Sirf ek environment me badalni ho to overrides.ts use karo.
 * Naya tunable tabhi jodo jab code use kare (ADR 0017).
 */
import type { Tunables } from "./schema.ts";

const SECOND_MS = 1_000;

export const baseTunables = {
  editLock: {
    // Section 7 "Versioning and concurrency": heartbeat every 15 seconds
    heartbeatIntervalMs: 15 * SECOND_MS,
    // Section 7: release after 60 seconds idle
    idleReleaseMs: 60 * SECOND_MS,
  },
  changes: {
    // Section 9 "Interaction rules": bulk accept with an undo toast for 10 seconds
    bulkAcceptUndoWindowMs: 10 * SECOND_MS,
  },
  decisions: {
    // Section 7 "AI agent design": add retrieval only when a product has more than about 200 decisions
    retrievalThresholdCount: 200,
  },
  shareLinks: {
    // NFR-12 + section 7: 128-bit random token = 16 bytes
    tokenBytes: 16,
  },
  retention: {
    // Section 8 "Rules for data": delete AI request logs after 30 days
    aiRequestLogDays: 30,
    // Section 8: deleting a product soft-deletes for 30 days
    productSoftDeleteDays: 30,
  },
} satisfies Tunables;
// `satisfies`: TS check karta hai ki shape schema se match kare, par values ka exact type bana rehta hai.
