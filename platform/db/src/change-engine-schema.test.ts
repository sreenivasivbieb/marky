/**
 * Change engine schema tests (Step 2a): RLS, GRANTs, integrity constraints. Engine logic ke tests modules/changes me.
 */
import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import { applyActor } from "./actor.ts";
import {
  createAdminTestDb,
  createProductAs,
  expectDbError,
  FAKE_BLOCK_HASH,
  inRolledBackTransaction,
  PG_ERROR,
  resetToAdmin,
  seedBlock,
  seedDocument,
  seedUser,
  userActor,
} from "./testing/db.ts";

const db = createAdminTestDb();
afterAll(() => db.destroy());

describe("documents + blocks RLS", () => {
  it("doosre tenant ke documents aur blocks nahi dikhte", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const bob = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      const doc = await seedDocument(trx, alpha, alice);
      await seedBlock(trx, doc, "a0");

      await applyActor(trx, userActor(bob));
      expect(await trx.selectFrom("documents").select("id").execute()).toEqual([]);
      expect(await trx.selectFrom("blocks").select("id").execute()).toEqual([]);
    }));

  it("reviewer padh sakta hai, document/block bana ya badal nahi sakta", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const bob = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      await trx.insertInto("memberships").values({ product_id: alpha.id, user_id: bob.id, role: "reviewer" }).execute();
      const doc = await seedDocument(trx, alpha, alice);
      const block = await seedBlock(trx, doc, "a0");

      await applyActor(trx, userActor(bob));
      expect(await trx.selectFrom("blocks").select("id").execute()).toHaveLength(1);

      const insertCode = await expectDbError(trx, () =>
        trx.insertInto("documents").values({ product_id: alpha.id, title: "X", created_by: bob.id }).execute(),
      );
      expect(insertCode).toBe(PG_ERROR.insufficientPrivilege);

      const updated = await trx.updateTable("blocks").set({ hash: FAKE_BLOCK_HASH.replace("0", "1") })
        .where("id", "=", block.id).executeTakeFirst();
      expect(updated.numUpdatedRows).toBe(0n);
    }));

  it("owner document bana sakta hai, par created_by kisi aur ka nahi likh sakta", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const bob = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");

      await applyActor(trx, userActor(alice));
      await trx.insertInto("documents").values({ product_id: alpha.id, title: "PRD", created_by: alice.id }).execute();
      const code = await expectDbError(trx, () =>
        trx.insertInto("documents").values({ product_id: alpha.id, title: "Forged", created_by: bob.id }).execute(),
      );
      expect(code).toBe(PG_ERROR.insufficientPrivilege);
    }));
});

describe("integrity constraints", () => {
  it("composite FK: block ka product_id uske document ke product se alag nahi ho sakta", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      const beta = await createProductAs(trx, alice, "Beta");
      const doc = await seedDocument(trx, alpha, alice);

      const code = await expectDbError(trx, () =>
        seedBlock(trx, { id: doc.id, product_id: beta.id }, "a0"),
      );
      expect(code).toBe(PG_ERROR.foreignKeyViolation);
    }));

  it("position byte-order (COLLATE \"C\") se sort hoti hai, en_US se nahi", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      const doc = await seedDocument(trx, alpha, alice);
      for (const position of ["a1", "B1", "a0", "Zz"]) await seedBlock(trx, doc, position);

      const rows = await trx.selectFrom("blocks").select("position")
        .where("document_id", "=", doc.id).orderBy("position").execute();
      expect(rows.map((r) => r.position)).toEqual(["B1", "Zz", "a0", "a1"]);
    }));

  it("ek document me do LIVE blocks ki same position nahi; removed block ki position reuse ho sakti hai", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      const doc = await seedDocument(trx, alpha, alice);
      const first = await seedBlock(trx, doc, "a0");

      expect(await expectDbError(trx, () => seedBlock(trx, doc, "a0"))).toBe(PG_ERROR.uniqueViolation);

      await trx.updateTable("blocks").set({ removed_at: new Date() }).where("id", "=", first.id).execute();
      await seedBlock(trx, doc, "a0"); // ab allowed
    }));

  it("block ka content.type aur type column match karne chahiye", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      const doc = await seedDocument(trx, alpha, alice);
      const code = await expectDbError(trx, () =>
        trx.insertInto("blocks").values({
          document_id: doc.id, product_id: alpha.id, position: "a0", type: "heading",
          content: JSON.stringify({ type: "paragraph", runs: [] }), hash: FAKE_BLOCK_HASH,
        }).execute(),
      );
      expect(code).toBe(PG_ERROR.checkViolation);
    }));

  it("adhoora Change (edit bina before ke) save nahi hota", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      const doc = await seedDocument(trx, alpha, alice);
      const block = await seedBlock(trx, doc, "a0");
      const code = await expectDbError(trx, () =>
        trx.insertInto("changes").values({
          document_id: doc.id, product_id: alpha.id, op: "edit", block_id: block.id,
          after: JSON.stringify({ type: "paragraph", runs: [{ text: "New" }] }),
          reason: "test", author_type: "ai", author_id: alice.id, base_version: 0,
        }).execute(),
      );
      expect(code).toBe(PG_ERROR.checkViolation);
    }));

  it("Change kisi doosre document ke block ko target nahi kar sakta", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      const docA = await seedDocument(trx, alpha, alice, "A");
      const docB = await seedDocument(trx, alpha, alice, "B");
      const blockInB = await seedBlock(trx, docB, "a0");
      const content = JSON.stringify({ type: "paragraph", runs: [{ text: "x" }] });
      const code = await expectDbError(trx, () =>
        trx.insertInto("changes").values({
          document_id: docA.id, product_id: alpha.id, op: "remove", block_id: blockInB.id,
          before: content, before_hash: FAKE_BLOCK_HASH,
          reason: "test", author_type: "ai", author_id: alice.id, base_version: 0,
        }).execute(),
      );
      expect(code).toBe(PG_ERROR.foreignKeyViolation);
    }));
});

describe("history immutability", () => {
  it("versions badle nahi ja sakte, audit_events badle/mitaye nahi ja sakte", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      const doc = await seedDocument(trx, alpha, alice);

      await applyActor(trx, userActor(alice));
      await trx.insertInto("versions").values({
        document_id: doc.id, product_id: alpha.id, number: 1,
        snapshot: JSON.stringify({ title: "Test PRD", blocks: [] }), created_by: alice.id,
      }).execute();
      await trx.insertInto("audit_events").values({
        product_id: alpha.id, actor_type: "user", actor_id: alice.id,
        action: "version.created", target_type: "document", target_id: doc.id,
      }).execute();

      const checks = [
        () => trx.updateTable("versions").set({ number: 2 }).execute(),
        () => sql`UPDATE versions SET snapshot = '{}'`.execute(trx),
        () => trx.deleteFrom("versions").execute(),
        () => trx.updateTable("audit_events").set({ action: "change.rejected" }).execute(),
        () => trx.deleteFrom("audit_events").execute(),
      ];
      for (const attempt of checks) {
        expect(await expectDbError(trx, attempt)).toBe(PG_ERROR.insufficientPrivilege);
      }
    }));

  it("audit event kisi aur user ke naam se nahi likha ja sakta", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const bob = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      await resetToAdmin(trx);

      await applyActor(trx, userActor(alice));
      const code = await expectDbError(trx, () =>
        trx.insertInto("audit_events").values({
          product_id: alpha.id, actor_type: "user", actor_id: bob.id,
          action: "document.created", target_type: "document", target_id: alpha.id,
        }).execute(),
      );
      expect(code).toBe(PG_ERROR.insufficientPrivilege);
    }));
});
