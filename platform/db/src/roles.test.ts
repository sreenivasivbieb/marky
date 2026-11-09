/**
 * App login role (`marky_app`) ke tests (ADR 0018). Ye ASLI app connection (TEST_DATABASE_URL) use karte hain,
 * admin wala nahi, kyunki yahi sabit karna hai ki app ka login khud kuch nahi kar sakta.
 */
import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import { withActor } from "./actor.ts";
import { createAppTestDb, expectDbError, getTestEnv, inRolledBackTransaction, PG_ERROR } from "./testing/db.ts";

const appDb = createAppTestDb();
afterAll(() => appDb.destroy());

describe("marky_app login role", () => {
  it("superuser nahi hai aur RLS bypass nahi kar sakta", async () => {
    const { rows } = await sql<{ rolsuper: boolean; rolbypassrls: boolean; rolinherit: boolean }>`
      SELECT rolsuper, rolbypassrls, rolinherit FROM pg_roles WHERE rolname = current_user
    `.execute(appDb);
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false, rolinherit: false });
  });

  it("bina SET ROLE ke tables dikhti bhi nahi (NOINHERIT + public schema PUBLIC se band)", () =>
    inRolledBackTransaction(appDb, async (trx) => {
      // marky_app ke paas `public` schema ka USAGE nahi hai, isliye `users` naam resolve hi nahi hota.
      const unqualified = await expectDbError(trx, () => trx.selectFrom("users").selectAll().execute());
      expect(unqualified).toBe(PG_ERROR.undefinedTable);

      // Schema ka naam saath likho tab bhi andar nahi ja sakta: "permission denied for schema public".
      const qualified = await expectDbError(trx, () => sql`SELECT * FROM public.users`.execute(trx));
      expect(qualified).toBe(PG_ERROR.insufficientPrivilege);
    }));

  it("marky_user me switch kar sakta hai, admin/superuser me nahi", () =>
    inRolledBackTransaction(appDb, async (trx) => {
      await sql`SET LOCAL ROLE marky_user`.execute(trx);
      await sql`RESET ROLE`.execute(trx);

      const adminRole = decodeURIComponent(new URL(getTestEnv().TEST_ADMIN_DATABASE_URL).username);
      const code = await expectDbError(trx, () => sql`SET LOCAL ROLE ${sql.id(adminRole)}`.execute(trx));
      expect(code).toBe(PG_ERROR.insufficientPrivilege);
    }));

  it("withActor ke baad app login se query chalti hai, aur commit ke baad role/actor mit jaate hain", async () => {
    const actor = { kind: "user" as const, id: "00000000-0000-7000-8000-000000000000" }; // koi existing user nahi
    const inside = await withActor(appDb, actor, async (trx) => {
      const { rows } = await sql<{ role: string; actor: string }>`
        SELECT current_user AS role, current_setting('app.actor', true) AS actor
      `.execute(trx);
      return rows[0];
    });
    expect(inside).toEqual({ role: "marky_user", actor: JSON.stringify(actor) });

    // Naya transaction (shayad wahi pooled connection): purana role/actor nahi hona chahiye.
    const after = await appDb.transaction().execute(async (trx) => {
      const { rows } = await sql<{ role: string; actor: string | null }>`
        SELECT current_user AS role, nullif(current_setting('app.actor', true), '') AS actor
      `.execute(trx);
      return rows[0];
    });
    expect(after).toEqual({ role: "marky_app", actor: null });
  });
});
