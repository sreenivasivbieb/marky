/**
 * BLOCK CONTENT SCHEMA (D53, D57, ADR 0022/0023).
 *
 * Ek block = ek typed JSON object. Inline formatting "text runs" me hai:
 *   { type: "paragraph", runs: [{ text: "Ship", marks: ["bold"] }, { text: " in Q1" }] }
 * Run = text ka ek tukda jiske saare characters ki formatting same hai.
 *
 * Ye schema teen jagah kaam aata hai: (1) AI ke `propose_change` ka `new_content` validate karna,
 * (2) editor (Tiptap) adapter ka output check karna, (3) DB me save hone se pehle.
 * Sab `strictObject` hain: anjaan field (jaise AI ka galat key) = error, chupchaap ignore nahi.
 */
import { z } from "zod";
import { BLOCK_TYPES } from "@marky/db";

/**
 * Content FORMAT ke constants (tunables nahi): inhe badalna = purane data ka migration, isliye ye config me nahi hain.
 */
export const HEADING_LEVELS = [1, 2, 3] as const;   // design doc section 9: type sizes 28/20/16 → 3 heading levels
export const MAX_LIST_DEPTH = 4;                    // nested list ki max gehraai (0 = top level)
export const TEXT_MARKS = ["bold", "italic", "strike", "code"] as const;
/** Link sirf in protocols ke ho sakte hain. `javascript:` jaise URL XSS (script injection) ka rasta hote hain. */
export const ALLOWED_LINK_PROTOCOLS = /^(https?|mailto)$/;

export type TextMark = (typeof TEXT_MARKS)[number];

export const runSchema = z.strictObject({
  text: z.string(),
  marks: z.array(z.enum(TEXT_MARKS)).optional(),
  link: z.url({ protocol: ALLOWED_LINK_PROTOCOLS }).optional(),
});
export type Run = z.infer<typeof runSchema>;

const runsSchema = z.array(runSchema);
const depthSchema = z.number().int().min(0).max(MAX_LIST_DEPTH);

const headingSchema = z.strictObject({
  type: z.literal("heading"),
  level: z.union(HEADING_LEVELS.map((level) => z.literal(level))),
  runs: runsSchema,
});
const paragraphSchema = z.strictObject({
  type: z.literal("paragraph"),
  runs: runsSchema,
});
const bulletItemSchema = z.strictObject({
  type: z.literal("bullet_item"),
  depth: depthSchema,
  runs: runsSchema,
});
const numberedItemSchema = z.strictObject({
  type: z.literal("numbered_item"),
  depth: depthSchema,
  runs: runsSchema,
});
const checklistItemSchema = z.strictObject({
  type: z.literal("checklist_item"),
  depth: depthSchema,
  checked: z.boolean(),
  runs: runsSchema,
});
const tableCellSchema = z.strictObject({ runs: runsSchema });
const tableSchema = z
  .strictObject({
    type: z.literal("table"),
    hasHeaderRow: z.boolean(),
    rows: z.array(z.array(tableCellSchema).min(1)).min(1),
  })
  // Har row me barabar cells, warna table toota hua dikhega.
  .refine((table) => table.rows.every((row) => row.length === table.rows[0]?.length), {
    message: "every table row must have the same number of cells",
    path: ["rows"],
  });

/** Koi bhi block. `type` field se Zod sahi schema chunta hai (discriminated union). */
export const blockContentSchema = z.discriminatedUnion("type", [
  headingSchema,
  paragraphSchema,
  bulletItemSchema,
  numberedItemSchema,
  checklistItemSchema,
  tableSchema,
]);
export type BlockContent = z.infer<typeof blockContentSchema>;

// Compile-time guard: schema ke types aur DB ke BLOCK_TYPES (value-lists, drift-tested) hamesha same rahein.
type SchemaBlockType = BlockContent["type"];
type DbBlockType = (typeof BLOCK_TYPES)[number];
const _schemaCoversDb: Record<DbBlockType, true> = {
  heading: true, paragraph: true, bullet_item: true, numbered_item: true, checklist_item: true, table: true,
} satisfies Record<SchemaBlockType, true>;
void _schemaCoversDb;
