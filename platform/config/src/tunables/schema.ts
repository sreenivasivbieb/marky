/**
 * TUNABLES SCHEMA: har tunable ka shape aur rules (ADR 0003, 0017).
 *
 * Naming rule: unit hamesha naam me ho (`...Ms`, `...Days`, `...Count`, `...Bytes`).
 * `strictObject`: unknown key (jaise typo `heartbeatMS`) error deti hai, chupchaap ignore nahi hoti.
 */
import { z } from "zod";

/**
 * Security floor (domain constant, tunable NAHI): NFR-12 kehta hai ki share token 128-bit random ho.
 * 128 bits = 16 bytes. Tunable isse bada ho sakta hai, chhota kabhi nahi.
 */
export const MIN_SHARE_TOKEN_BYTES = 16;

const positiveInt = z.number().int().positive();

const editLockSchema = z
  .strictObject({
    heartbeatIntervalMs: positiveInt,
    idleReleaseMs: positiveInt,
  })
  // Cross-field rule: heartbeat release se pehle aana chahiye, warna active editor ka lock bhi chhoot jaayega.
  .refine((lock) => lock.heartbeatIntervalMs < lock.idleReleaseMs, {
    message: "heartbeatIntervalMs must be smaller than idleReleaseMs",
    path: ["heartbeatIntervalMs"],
  });

export const tunablesSchema = z.strictObject({
  editLock: editLockSchema,
  changes: z.strictObject({
    bulkAcceptUndoWindowMs: positiveInt,
  }),
  decisions: z.strictObject({
    retrievalThresholdCount: positiveInt,
  }),
  shareLinks: z.strictObject({
    tokenBytes: z.number().int().min(MIN_SHARE_TOKEN_BYTES),
  }),
  retention: z.strictObject({
    aiRequestLogDays: positiveInt,
    productSoftDeleteDays: positiveInt,
  }),
});

export type Tunables = z.infer<typeof tunablesSchema>;
