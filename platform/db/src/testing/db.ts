/**
 * DB test helpers (ADR 0020). Sirf tests ke liye; public API (index.ts) se export nahi hote.
 *
 * Strategy: alag `marky_test` DB. Har test ek transaction me chalta hai jo end me ROLLBACK hota hai, to koi data
 * nahi bachta aur tests ek-doosre ko affect nahi karte. `./dev test` test DB banata aur migrate karta hai.
 */
import { randomUUID } from "node:crypto";
import { sql, type Transaction } from "kysely";
import { z } from "zod";
import { applyActor, type Actor } from "../actor.ts";
import { createDb, type Database } from "../client.ts";
import type { DB } from "../generated/database.ts";

const testEnvSchema = z.object({
  TEST_ADMIN_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  TEST_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export function getTestEnv(): z.infer<typeof testEnvSchema> {
  const result = testEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error("DB test env missing. Tests './dev test' se chalao (wo test DB bhi taiyaar karta hai).");
  }
  return result.data;
}

/** Admin (superuser) connection: seeding ke liye. Assertions hamesha `applyActor` ke baad karo. */
export function createAdminTestDb(): Database {
  return createDb({ connectionString: getTestEnv().TEST_ADMIN_DATABASE_URL });
}

/** marky_app connection: wahi login jo asli app use karta hai. */
export function createAppTestDb(): Database {
  return createDb({ connectionString: getTestEnv().TEST_DATABASE_URL });
}

class RollbackSignal extends Error {}

/** `fn` ko ek transaction me chalao jo hamesha ROLLBACK hota hai. */
export async function inRolledBackTransaction(
  db: Database,
  fn: (trx: Transaction<DB>) => Promise<void>,
): Promise<void> {
  try {
    await db.transaction().execute(async (trx) => {
      await fn(trx);
      throw new RollbackSignal();
    });
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error;
  }
}

/** Wapas admin ban jao aur actor hata do (seeding ke liye). Sirf admin connection par kaam karta hai. */
export async function resetToAdmin(trx: Transaction<DB>): Promise<void> {
  await sql`RESET ROLE`.execute(trx);
  await sql`SELECT set_config('app.actor', '', true)`.execute(trx);
}

export function userActor(user: { id: string }): Actor {
  return { kind: "user", id: user.id };
}

/** Random email wala user banao (admin ke roop me). Random isliye ki parallel tests me UNIQUE email na takraye. */
export async function seedUser(trx: Transaction<DB>, name = "Test User"): Promise<{ id: string; email: string }> {
  return trx
    .insertInto("users")
    .values({ email: `user-${randomUUID()}@example.test`, name })
    .returning(["id", "email"])
    .executeTakeFirstOrThrow();
}

/** `owner` ke roop me product banao (app.create_product), phir wapas admin. */
export async function createProductAs(
  trx: Transaction<DB>,
  owner: { id: string },
  name: string,
): Promise<{ id: string; name: string }> {
  await applyActor(trx, userActor(owner));
  const { rows } = await sql<{ id: string; name: string }>`SELECT id, name FROM app.create_product(${name})`.execute(trx);
  await resetToAdmin(trx);
  const product = rows[0];
  if (!product) throw new Error("create_product returned no row");
  return product;
}

/** Test-only placeholder hash (64 hex). Asli hash modules/documents banata hai. */
export const FAKE_BLOCK_HASH = "0".repeat(64);

/** Document seed karo (admin ke roop me). */
export async function seedDocument(
  trx: Transaction<DB>,
  product: { id: string },
  createdBy: { id: string },
  title = "Test PRD",
): Promise<{ id: string; product_id: string }> {
  return trx
    .insertInto("documents")
    .values({ product_id: product.id, title, created_by: createdBy.id })
    .returning(["id", "product_id"])
    .executeTakeFirstOrThrow();
}

/** Paragraph block seed karo (admin ke roop me). */
export async function seedBlock(
  trx: Transaction<DB>,
  document: { id: string; product_id: string },
  position: string,
  text = "Hello",
): Promise<{ id: string }> {
  return trx
    .insertInto("blocks")
    .values({
      document_id: document.id,
      product_id: document.product_id,
      position,
      type: "paragraph",
      content: JSON.stringify({ type: "paragraph", runs: [{ text }] }),
      hash: FAKE_BLOCK_HASH,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();
}

/** Postgres error codes jo tests me check hote hain (https://www.postgresql.org/docs/current/errcodes-appendix.html). */
export const PG_ERROR = {
  insufficientPrivilege: "42501", // permission denied, ya "new row violates row-level security policy"
  checkViolation: "23514",
  undefinedTable: "42P01",        // table naam se resolve hi nahi hui (jaise schema ka USAGE nahi hai)
  foreignKeyViolation: "23503",
  uniqueViolation: "23505",
} as const;

/**
 * Expect karo ki `fn` DB error de. Postgres me ek error poore transaction ko "aborted" kar deta hai, isliye SAVEPOINT
 * lagate hain aur error ke baad wahin tak rollback karte hain. Test transaction aage chalta rehta hai.
 * Error ka SQLSTATE code lautata hai.
 */
export async function expectDbError(trx: Transaction<DB>, fn: () => Promise<unknown>): Promise<string> {
  await sql`SAVEPOINT expect_db_error`.execute(trx);
  try {
    await fn();
  } catch (error) {
    await sql`ROLLBACK TO SAVEPOINT expect_db_error`.execute(trx);
    const code = (error as { code?: unknown }).code;
    if (typeof code !== "string") throw error;
    return code;
  }
  throw new Error("expected a database error, but the statement succeeded");
}
