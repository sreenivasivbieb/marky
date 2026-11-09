/**
 * AI layer schema tests (Step 3a): chat_turns, ai_requests, decisions-from-chat. Key ke tests modules/ai me.
 */
import { afterAll, describe, expect, it } from "vitest";
import { applyActor } from "./actor.ts";
import {
  createAdminTestDb, createProductAs, expectDbError, inRolledBackTransaction, PG_ERROR, resetToAdmin, seedDocument, seedUser, userActor,
} from "./testing/db.ts";

const db = createAdminTestDb();
afterAll(() => db.destroy());

describe("chat_turns", () => {
  it("owner likh sakta, reviewer padh sakta par likh nahi sakta; append-only", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const bob = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      await trx.insertInto("memberships").values({ product_id: alpha.id, user_id: bob.id, role: "reviewer" }).execute();
      const doc = await seedDocument(trx, alpha, alice);
      const turn = { document_id: doc.id, product_id: alpha.id, role: "user" as const, mode: "draft" as const, content: "Hi" };

      await applyActor(trx, userActor(alice));
      await trx.insertInto("chat_turns").values({ ...turn, author_id: alice.id }).execute();

      await applyActor(trx, userActor(bob));
      expect(await trx.selectFrom("chat_turns").select("id").execute()).toHaveLength(1);
      expect(await expectDbError(trx, () => trx.insertInto("chat_turns").values({ ...turn, author_id: bob.id }).execute()))
        .toBe(PG_ERROR.insufficientPrivilege);

      await applyActor(trx, userActor(alice));
      expect(await expectDbError(trx, () => trx.updateTable("chat_turns").set({ content: "edited" }).execute()))
        .toBe(PG_ERROR.insufficientPrivilege);
    }));

  it("user turn par decision suggestions nahi ho sakte", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      const doc = await seedDocument(trx, alpha, alice);
      const code = await expectDbError(trx, () => trx.insertInto("chat_turns").values({
        document_id: doc.id, product_id: alpha.id, role: "user", mode: "draft", author_id: alice.id, content: "x",
        decision_suggestions: JSON.stringify([{ summary: "s", reason: "r" }]),
      }).execute());
      expect(code).toBe(PG_ERROR.checkViolation);
    }));
});

describe("decisions from chat (ADR 0026)", () => {
  it("decision ya Change se ya chat turn se; dono ya koi nahi = error", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      const doc = await seedDocument(trx, alpha, alice);
      await trx.insertInto("versions").values({
        document_id: doc.id, product_id: alpha.id, number: 1, snapshot: { title: "t", blocks: [] }, created_by: alice.id,
      }).execute();
      const turn = await trx.insertInto("chat_turns").values({
        document_id: doc.id, product_id: alpha.id, role: "user", mode: "draft", author_id: alice.id, content: "Q2 me nahi",
      }).returning("id").executeTakeFirstOrThrow();
      const base = { product_id: alpha.id, document_id: doc.id, version_number: 1, summary: "Not in Q2", reason: "Capacity", created_by: alice.id };

      await trx.insertInto("decisions").values({ ...base, chat_turn_id: turn.id }).execute();
      expect(await expectDbError(trx, () => trx.insertInto("decisions").values(base).execute())).toBe(PG_ERROR.checkViolation);
    }));
});

describe("ai_requests (usage ledger)", () => {
  it("row hamesha current user ke naam se; members usage dekh sakte", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const bob = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      await trx.insertInto("memberships").values({ product_id: alpha.id, user_id: bob.id, role: "viewer" }).execute();
      const row = {
        product_id: alpha.id, purpose: "chat" as const, provider: "openai" as const, model: "m",
        status: "succeeded" as const, input_tokens: 10, output_tokens: 5, duration_ms: 100,
      };
      await applyActor(trx, userActor(alice));
      await trx.insertInto("ai_requests").values({ ...row, user_id: alice.id }).execute();
      expect(await expectDbError(trx, () => trx.insertInto("ai_requests").values({ ...row, user_id: bob.id }).execute()))
        .toBe(PG_ERROR.insufficientPrivilege);

      await applyActor(trx, userActor(bob));
      expect(await trx.selectFrom("ai_requests").select(["input_tokens", "output_tokens"]).execute())
        .toEqual([{ input_tokens: 10, output_tokens: 5 }]);
    }));

  it("redacted row me payload nahi reh sakta", () =>
    inRolledBackTransaction(db, async (trx) => {
      const alice = await seedUser(trx);
      const alpha = await createProductAs(trx, alice, "Alpha");
      await resetToAdmin(trx);
      const code = await expectDbError(trx, () => trx.insertInto("ai_requests").values({
        product_id: alpha.id, user_id: alice.id, purpose: "chat", provider: "anthropic", model: "m", status: "succeeded",
        duration_ms: 1, request_payload: { prompt: "secret plan" }, redacted_at: new Date(),
      }).execute());
      expect(code).toBe(PG_ERROR.checkViolation);
    }));
});
