/**
 * RLS tests: tenancy core (ADR 0018, 0019). Design doc testing strategy: "a test that tries to read another
 * product's rows and must fail".
 *
 * Har test: admin ke roop me seed karo → `applyActor` (SET LOCAL ROLE marky_user + actor) → assert. End me ROLLBACK.
 */
import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import { applyActor } from "./actor.ts";
import {
  createAdminTestDb,
  createProductAs,
  expectDbError,
  inRolledBackTransaction,
  PG_ERROR,
  resetToAdmin,
  seedUser,
  userActor,
} from "./testing/db.ts";

const db = createAdminTestDb();
afterAll(() => db.destroy());

describe("RLS: products", () => {
  it("user sirf apne products dekhta hai, doosre tenant ke nahi", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const bob = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      await createProductAs(trx, bob, "Beta");

      await applyActor(trx, userActor(alice));
      const visible = await trx.selectFrom("products").select("id").execute();
      expect(visible.map((p) => p.id)).toEqual([alpha.id]);
    }));

  it("actor set na ho to kuch bhi nahi dikhta (fail closed)", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      await createProductAs(trx, alice, "Alpha");

      await sql`SET LOCAL ROLE marky_user`.execute(trx); // role hai, actor nahi
      expect(await trx.selectFrom("products").select("id").execute()).toEqual([]);
      expect(await trx.selectFrom("users").select("id").execute()).toEqual([]);
    }));

  it("doosre tenant ka product rename nahi hota (0 rows affected, data same)", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const bob = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");

      await applyActor(trx, userActor(bob));
      const result = await trx.updateTable("products").set({ name: "Hacked" }).where("id", "=", alpha.id).executeTakeFirst();
      expect(result.numUpdatedRows).toBe(0n);

      await resetToAdmin(trx);
      const row = await trx.selectFrom("products").select("name").where("id", "=", alpha.id).executeTakeFirstOrThrow();
      expect(row.name).toBe("Alpha");
    }));

  it("reviewer product dekh sakta hai par rename nahi kar sakta; owner kar sakta hai", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const bob = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      await trx.insertInto("memberships").values({ product_id: alpha.id, user_id: bob.id, role: "reviewer" }).execute();

      await applyActor(trx, userActor(bob));
      expect(await trx.selectFrom("products").select("id").execute()).toHaveLength(1);
      const asReviewer = await trx.updateTable("products").set({ name: "X" }).where("id", "=", alpha.id).executeTakeFirst();
      expect(asReviewer.numUpdatedRows).toBe(0n);

      await applyActor(trx, userActor(alice));
      const asOwner = await trx.updateTable("products").set({ name: "Alpha 2" }).where("id", "=", alpha.id).executeTakeFirst();
      expect(asOwner.numUpdatedRows).toBe(1n);
    }));

  it("products me seedha INSERT allowed nahi; sirf app.create_product()", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      await applyActor(trx, userActor(alice));
      const code = await expectDbError(trx, () =>
        trx.insertInto("products").values({ name: "Sneaky", created_by: alice.id }).execute(),
      );
      expect(code).toBe(PG_ERROR.insufficientPrivilege);
    }));

  it("bina signed-in user ke create_product fail hota hai", () =>
    inRolledBackTransaction(db, async (trx) => {
      await sql`SET LOCAL ROLE marky_user`.execute(trx);
      const code = await expectDbError(trx, () => sql`SELECT app.create_product('Orphan')`.execute(trx));
      expect(code).toBe(PG_ERROR.insufficientPrivilege);
    }));
});

describe("RLS: memberships", () => {
  it("owner member jod sakta hai; reviewer nahi", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const bob = await seedUser(trx);
      const carol = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      await trx.insertInto("memberships").values({ product_id: alpha.id, user_id: bob.id, role: "reviewer" }).execute();

      await applyActor(trx, userActor(bob));
      const code = await expectDbError(trx, () =>
        trx.insertInto("memberships").values({ product_id: alpha.id, user_id: carol.id, role: "viewer" }).execute(),
      );
      expect(code).toBe(PG_ERROR.insufficientPrivilege);

      await applyActor(trx, userActor(alice));
      await trx.insertInto("memberships").values({ product_id: alpha.id, user_id: carol.id, role: "viewer" }).execute();
      expect(await trx.selectFrom("memberships").select("user_id").where("product_id", "=", alpha.id).execute()).toHaveLength(3);
    }));

  it("doosre tenant ki memberships nahi dikhti", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const bob = await seedUser(trx);
      await createProductAs(trx, alice, "Alpha");
      const beta = await createProductAs(trx, bob, "Beta");

      await applyActor(trx, userActor(alice));
      const rows = await trx.selectFrom("memberships").select("product_id").where("product_id", "=", beta.id).execute();
      expect(rows).toEqual([]);
    }));

  it("membership ko doosre product par khiskana allowed nahi (sirf `role` column update ho sakta hai)", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      const beta = await createProductAs(trx, alice, "Beta");

      await applyActor(trx, userActor(alice));
      const code = await expectDbError(trx, () =>
        trx.updateTable("memberships").set({ product_id: beta.id }).where("product_id", "=", alpha.id).execute(),
      );
      expect(code).toBe(PG_ERROR.insufficientPrivilege);
    }));

  it("aakhri owner hat ya demote nahi ho sakta; doosra owner ho to ho sakta hai", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const bob = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");

      await applyActor(trx, userActor(alice));
      const deleteCode = await expectDbError(trx, () =>
        trx.deleteFrom("memberships")
          .where("product_id", "=", alpha.id).where("user_id", "=", alice.id).execute(),
      );
      expect(deleteCode).toBe(PG_ERROR.checkViolation);
      const demoteCode = await expectDbError(trx, () =>
        trx.updateTable("memberships").set({ role: "viewer" })
          .where("product_id", "=", alpha.id).where("user_id", "=", alice.id).execute(),
      );
      expect(demoteCode).toBe(PG_ERROR.checkViolation);

      // Bob ko owner banao (multiple owners allowed, ADR 0019), ab Alice khud ko demote kar sakti hai.
      await trx.insertInto("memberships").values({ product_id: alpha.id, user_id: bob.id, role: "owner" }).execute();
      const demoted = await trx.updateTable("memberships").set({ role: "viewer" })
        .where("product_id", "=", alpha.id).where("user_id", "=", alice.id).executeTakeFirst();
      expect(demoted.numUpdatedRows).toBe(1n);
    }));
});

describe("RLS: users", () => {
  it("doosra user tabhi dikhta hai jab koi product share ho", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const bob = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");

      await applyActor(trx, userActor(alice));
      const before = await trx.selectFrom("users").select("id").execute();
      expect(before.map((u) => u.id)).toEqual([alice.id]);

      await trx.insertInto("memberships").values({ product_id: alpha.id, user_id: bob.id, role: "viewer" }).execute();
      const after = await trx.selectFrom("users").select("id").orderBy("id").execute();
      expect(after.map((u) => u.id).sort()).toEqual([alice.id, bob.id].sort());
    }));

  it("user sirf apna naam badal sakta hai, doosre ka nahi", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const bob = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      await trx.insertInto("memberships").values({ product_id: alpha.id, user_id: bob.id, role: "viewer" }).execute();

      await applyActor(trx, userActor(alice));
      const own = await trx.updateTable("users").set({ name: "Alice" }).where("id", "=", alice.id).executeTakeFirst();
      const other = await trx.updateTable("users").set({ name: "Hacked" }).where("id", "=", bob.id).executeTakeFirst();
      expect(own.numUpdatedRows).toBe(1n);
      expect(other.numUpdatedRows).toBe(0n);
    }));

  it("email sirf lowercase save hota hai (CHECK constraint)", () =>
    inRolledBackTransaction(db, async (trx) => {
      const code = await expectDbError(trx, () =>
        trx.insertInto("users").values({ email: "Mixed.Case@Example.test" }).execute(),
      );
      expect(code).toBe(PG_ERROR.checkViolation);
    }));
});

describe("guest role", () => {
  it("marky_guest ko abhi kisi table ka access nahi (policies sharing step me aayengi)", () =>
    inRolledBackTransaction(db, async (trx) => {
      await sql`SET LOCAL ROLE marky_guest`.execute(trx);
      for (const table of ["users", "products", "memberships"] as const) {
        const code = await expectDbError(trx, () => trx.selectFrom(table).selectAll().execute());
        expect(code).toBe(PG_ERROR.insufficientPrivilege);
      }
    }));
});
