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

/** Registry: "table.column" → allowed values. Drift test isi ko DB se milata hai. */
export const VALUE_LISTS = {
  "memberships.role": MEMBERSHIP_ROLES,
  "products.plan": PRODUCT_PLANS,
} as const satisfies Record<string, readonly string[]>;
