/**
 * Change engine integration tests (asli Postgres, har test rollback). Design doc section 12 "Testing strategy":
 *   "accept then restore returns the original text; two accepts on one block never both apply".
 */
import { applyActor, type Actor } from "@marky/db";
import {
  createAdminTestDb,
  createProductAs,
  inRolledBackTransaction,
  resetToAdmin,
  seedUser,
  userActor,
} from "@marky/db/testing";
import { blockContentSchema, runsText } from "@marky/documents";
import fc from "fast-check";
import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import {
  acceptChanges,
  ChangeEngineError,
  createDocument,
  proposeChange,
  proposeRestore,
  rejectChange,
  saveHumanEdit,
  type ChangeEngineErrorCode,
} from "./index.ts";
import type { Tx } from "./internal.ts";

const db = createAdminTestDb();
afterAll(() => db.destroy());

/** Property test kitni random scenarios chalaye (har ek asli DB transaction hai, isliye moderate). */
const RESTORE_PROPERTY_RUNS = 25;

const para = (text: string) => ({ type: "paragraph", runs: [{ text }] });

async function setup(trx: Tx, texts: string[] = ["One", "Two", "Three"]) {
  const alice = await seedUser(trx, "Alice");
  const product = await createProductAs(trx, alice, "Alpha");
  const actor: Actor = userActor(alice);
  await applyActor(trx, actor);
  const { documentId, version } = await createDocument(trx, actor, {
    productId: product.id, title: "PRD", blocks: texts.map(para),
  });
  return { alice, actor, product, documentId, version };
}

async function live(trx: Tx, documentId: string): Promise<{ id: string; text: string }[]> {
  const rows = await trx.selectFrom("blocks").select(["id", "content"])
    .where("document_id", "=", documentId).where("removed_at", "is", null).orderBy("position").execute();
  return rows.map((row) => {
    const content = blockContentSchema.parse(row.content);
    return { id: row.id, text: content.type === "table" ? "" : runsText(content.runs) };
  });
}

async function change(trx: Tx, id: string) {
  return trx.selectFrom("changes").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
}

async function currentVersion(trx: Tx, documentId: string): Promise<number> {
  const doc = await trx.selectFrom("documents").select("current_version").where("id", "=", documentId).executeTakeFirstOrThrow();
  return doc.current_version;
}

async function expectEngineError(promise: Promise<unknown>, code: ChangeEngineErrorCode): Promise<void> {
  await expect(promise).rejects.toSatisfy((e: unknown) => e instanceof ChangeEngineError && e.code === code);
}

describe("createDocument", () => {
  it("blocks order me, version 1, audit events", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { documentId, version, product } = await setup(trx);
      expect(version).toBe(1);
      expect((await live(trx, documentId)).map((b) => b.text)).toEqual(["One", "Two", "Three"]);
      const actions = await trx.selectFrom("audit_events").select("action")
        .where("product_id", "=", product.id).orderBy("id").execute();
      expect(actions.map((a) => a.action)).toEqual(["document.created", "version.created"]);
    }));

  it("galat block content par invalid_input, kuch save nahi", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, product } = await setup(trx);
      await expectEngineError(
        createDocument(trx, actor, { productId: product.id, title: "Bad", blocks: [{ type: "video" }] }),
        "invalid_input",
      );
    }));
});

describe("propose → accept / reject", () => {
  it("AI ka proposal document nahi badalta; accept karne par badalta hai aur naya version banta hai", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId } = await setup(trx);
      const [, two] = await live(trx, documentId);
      const id = await proposeChange(trx, actor, {
        documentId, reason: "Clearer wording", authorType: "ai",
        change: { op: "edit", blockId: two?.id ?? "", content: para("Two, clearer") },
      });
      expect((await live(trx, documentId)).map((b) => b.text)).toEqual(["One", "Two", "Three"]);
      expect((await change(trx, id)).status).toBe("pending");

      const result = await acceptChanges(trx, actor, { documentId, items: [{ changeId: id }] });
      expect(result).toMatchObject({ version: 2, accepted: [id], stale: [] });
      expect((await live(trx, documentId)).map((b) => b.text)).toEqual(["One", "Two, clearer", "Three"]);
      expect(await change(trx, id)).toMatchObject({ status: "accepted", resulting_version: 2 });
    }));

  it("edit-then-accept (D62): AI ka `after` waisa hi, owner ka content `accepted_after` me", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId } = await setup(trx);
      const [one] = await live(trx, documentId);
      const id = await proposeChange(trx, actor, {
        documentId, reason: "Tighten", authorType: "ai", change: { op: "edit", blockId: one?.id ?? "", content: para("AI text") },
      });
      await acceptChanges(trx, actor, { documentId, items: [{ changeId: id, acceptedContent: para("Owner text") }] });

      const row = await change(trx, id);
      expect(row.after).toEqual(para("AI text"));
      expect(row.accepted_after).toEqual(para("Owner text"));
      expect((await live(trx, documentId))[0]?.text).toBe("Owner text");
    }));

  it("reject: note save, document aur version same; rejected ko accept nahi kar sakte", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId } = await setup(trx);
      const [one] = await live(trx, documentId);
      const id = await proposeChange(trx, actor, {
        documentId, reason: "x", authorType: "ai", change: { op: "remove", blockId: one?.id ?? "" },
      });
      await rejectChange(trx, actor, { changeId: id, note: "Keep it" });
      expect(await change(trx, id)).toMatchObject({ status: "rejected", decision_note: "Keep it" });
      expect(await currentVersion(trx, documentId)).toBe(1);
      await expectEngineError(acceptChanges(trx, actor, { documentId, items: [{ changeId: id }] }), "change_not_pending");
    }));

  it("AI ka galat content invalid_input deta hai", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId } = await setup(trx);
      await expectEngineError(proposeChange(trx, actor, {
        documentId, reason: "x", authorType: "ai",
        change: { op: "add", anchorBlockId: null, content: { type: "paragraph", runs: [], colour: "red" } },
      }), "invalid_input");
    }));
});

describe("stale (D58, D63)", () => {
  it("eager: owner ne block edit kiya to us par pending AI change turant stale", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId } = await setup(trx);
      const [one] = await live(trx, documentId);
      const aiChange = await proposeChange(trx, actor, {
        documentId, reason: "AI idea", authorType: "ai", change: { op: "edit", blockId: one?.id ?? "", content: para("AI") },
      });
      await saveHumanEdit(trx, actor, { documentId, change: { op: "edit", blockId: one?.id ?? "", content: para("Mine") } });

      expect((await change(trx, aiChange)).status).toBe("stale");
      const result = await acceptChanges(trx, actor, { documentId, items: [{ changeId: aiChange }] });
      expect(result).toMatchObject({ version: null, accepted: [], stale: [{ changeId: aiChange, reason: "already_stale" }] });
      expect((await live(trx, documentId))[0]?.text).toBe("Mine");
    }));

  it("lazy re-check: block engine ke bahar badla ho tab bhi accept par hash mismatch pakda jaata hai", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId } = await setup(trx);
      const [one] = await live(trx, documentId);
      const id = await proposeChange(trx, actor, {
        documentId, reason: "x", authorType: "ai", change: { op: "edit", blockId: one?.id ?? "", content: para("AI") },
      });
      await resetToAdmin(trx);
      await trx.updateTable("blocks").set({ hash: "f".repeat(64) }).where("id", "=", one?.id ?? "").execute();
      await applyActor(trx, actor);

      const result = await acceptChanges(trx, actor, { documentId, items: [{ changeId: id }] });
      expect(result.stale).toEqual([{ changeId: id, reason: "block_changed" }]);
      expect(result.version).toBeNull();
    }));

  it("ek block par do accepts kabhi dono apply nahi hote (design doc)", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId } = await setup(trx);
      const [one] = await live(trx, documentId);
      const spec = (text: string) => ({ op: "edit" as const, blockId: one?.id ?? "", content: para(text) });
      const first = await proposeChange(trx, actor, { documentId, reason: "a", authorType: "ai", change: spec("A") });
      const second = await proposeChange(trx, actor, { documentId, reason: "b", authorType: "ai", change: spec("B") });

      const result = await acceptChanges(trx, actor, { documentId, items: [{ changeId: second }, { changeId: first }] });
      expect(result.accepted).toEqual([first]); // banne ka order, input ka nahi
      expect(result.stale).toEqual([{ changeId: second, reason: "block_changed" }]);
      expect((await live(trx, documentId))[0]?.text).toBe("A");
    }));

  it("bulk accept me ek stale: baaki apply, EK version, stale alag report (D63)", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId } = await setup(trx);
      const blocks = await live(trx, documentId);
      const ids: string[] = [];
      for (const [i, block] of blocks.entries()) {
        ids.push(await proposeChange(trx, actor, {
          documentId, reason: "bulk", authorType: "ai", change: { op: "edit", blockId: block.id, content: para(`AI ${i}`) },
        }));
      }
      await saveHumanEdit(trx, actor, { documentId, change: { op: "edit", blockId: blocks[1]?.id ?? "", content: para("Owner") } });
      const versionBefore = await currentVersion(trx, documentId);

      const result = await acceptChanges(trx, actor, { documentId, items: ids.map((changeId) => ({ changeId })) });
      expect(result.accepted).toEqual([ids[0], ids[2]]);
      expect(result.stale).toEqual([{ changeId: ids[1], reason: "already_stale" }]);
      expect(result.version).toBe(versionBefore + 1);
      expect((await live(trx, documentId)).map((b) => b.text)).toEqual(["AI 0", "Owner", "AI 2"]);
    }));
});

describe("add / remove", () => {
  it("add: shuruaat me aur kisi block ke baad, order sahi", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId } = await setup(trx);
      const [, two] = await live(trx, documentId);
      await saveHumanEdit(trx, actor, { documentId, change: { op: "add", anchorBlockId: null, content: para("Zero") } });
      await saveHumanEdit(trx, actor, { documentId, change: { op: "add", anchorBlockId: two?.id ?? "", content: para("Two.5") } });
      expect((await live(trx, documentId)).map((b) => b.text)).toEqual(["Zero", "One", "Two", "Two.5", "Three"]);
    }));

  it("remove: block live se hatta hai (soft delete); us par pending edit aur uske baad ke pending add stale", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId } = await setup(trx);
      const [, two] = await live(trx, documentId);
      const edit = await proposeChange(trx, actor, {
        documentId, reason: "x", authorType: "ai", change: { op: "edit", blockId: two?.id ?? "", content: para("AI") },
      });
      const add = await proposeChange(trx, actor, {
        documentId, reason: "x", authorType: "ai", change: { op: "add", anchorBlockId: two?.id ?? "", content: para("After two") },
      });
      await saveHumanEdit(trx, actor, { documentId, change: { op: "remove", blockId: two?.id ?? "" } });

      expect((await live(trx, documentId)).map((b) => b.text)).toEqual(["One", "Three"]);
      expect((await change(trx, edit)).status).toBe("stale");
      expect((await change(trx, add)).status).toBe("stale");
      const removedRow = await trx.selectFrom("blocks").select("removed_at").where("id", "=", two?.id ?? "").executeTakeFirstOrThrow();
      expect(removedRow.removed_at).not.toBeNull();
    }));
});

describe("decisions + permissions + state", () => {
  it("accept ke saath decision: version se juda decision row; stale ka decision nahi banta", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId } = await setup(trx);
      const [one, two] = await live(trx, documentId);
      const good = await proposeChange(trx, actor, {
        documentId, reason: "scope", authorType: "ai", change: { op: "edit", blockId: one?.id ?? "", content: para("Web only") },
      });
      const doomed = await proposeChange(trx, actor, {
        documentId, reason: "x", authorType: "ai", change: { op: "edit", blockId: two?.id ?? "", content: para("AI") },
      });
      await saveHumanEdit(trx, actor, { documentId, change: { op: "edit", blockId: two?.id ?? "", content: para("Owner") } });

      const decision = { summary: "Web first", reason: "Mobile users < 5%" };
      const result = await acceptChanges(trx, actor, {
        documentId, items: [{ changeId: good, decision }, { changeId: doomed, decision }],
      });
      expect(result.decisions).toHaveLength(1);
      const row = await trx.selectFrom("decisions").selectAll().where("id", "=", result.decisions[0] ?? "").executeTakeFirstOrThrow();
      expect(row).toMatchObject({ change_id: good, version_number: result.version, status: "active", reason: decision.reason });
    }));

  it("final document par na propose na accept (document_final)", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId } = await setup(trx);
      const [one] = await live(trx, documentId);
      const id = await proposeChange(trx, actor, {
        documentId, reason: "x", authorType: "ai", change: { op: "remove", blockId: one?.id ?? "" },
      });
      await trx.updateTable("documents").set({ state: "final" }).where("id", "=", documentId).execute();

      await expectEngineError(proposeChange(trx, actor, {
        documentId, reason: "x", authorType: "ai", change: { op: "remove", blockId: one?.id ?? "" },
      }), "document_final");
      await expectEngineError(acceptChanges(trx, actor, { documentId, items: [{ changeId: id }] }), "document_final");
    }));

  it("reviewer accept nahi kar sakta (owner-only, RLS se document hi nahi milta)", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId, product } = await setup(trx);
      const [one] = await live(trx, documentId);
      const id = await proposeChange(trx, actor, {
        documentId, reason: "x", authorType: "ai", change: { op: "remove", blockId: one?.id ?? "" },
      });
      await resetToAdmin(trx);
      const bob = await seedUser(trx, "Bob");
      await trx.insertInto("memberships").values({ product_id: product.id, user_id: bob.id, role: "reviewer" }).execute();
      await applyActor(trx, userActor(bob));

      await expectEngineError(acceptChanges(trx, userActor(bob), { documentId, items: [{ changeId: id }] }), "document_not_found");
      expect((await change(trx, id)).status).toBe("pending");
    }));
});

describe("restore (FR-20, D61)", () => {
  it("restore pending Changes banata hai; document tab tak nahi badalta; accept all = v1 wapas (same block ids)", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId } = await setup(trx);
      const original = await live(trx, documentId);
      const [, two, three] = original;
      await saveHumanEdit(trx, actor, { documentId, change: { op: "edit", blockId: two?.id ?? "", content: para("2") } });
      await saveHumanEdit(trx, actor, { documentId, change: { op: "remove", blockId: three?.id ?? "" } });
      await saveHumanEdit(trx, actor, { documentId, change: { op: "add", anchorBlockId: two?.id ?? "", content: para("Four") } });
      const beforeRestore = await live(trx, documentId);

      const ids = await proposeRestore(trx, actor, { documentId, versionNumber: 1 });
      expect(await live(trx, documentId)).toEqual(beforeRestore);
      for (const id of ids) expect(await change(trx, id)).toMatchObject({ status: "pending", restore_of_version: 1 });

      const result = await acceptChanges(trx, actor, { documentId, items: ids.map((changeId) => ({ changeId })) });
      expect(result.stale).toEqual([]);
      expect(await live(trx, documentId)).toEqual(original);
    }));

  it("kuch nahi badla to restore khaali set deta hai", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId } = await setup(trx);
      expect(await proposeRestore(trx, actor, { documentId, versionNumber: 1 })).toEqual([]);
    }));

  it("property: kitne bhi random edits/adds/removes ke baad restore(v1) + accept all = v1 (text, order, ids)", async () => {
    const opArb = fc.record({
      kind: fc.constantFrom("edit", "add", "remove"),
      pick: fc.nat(),
      text: fc.string({ minLength: 1, maxLength: 5 }),
    });
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { minLength: 1, maxLength: 8 }), (ops) =>
        inRolledBackTransaction(db, async (trx) => {
          const { actor, documentId } = await setup(trx);
          const original = await live(trx, documentId);

          for (const op of ops) {
            const blocks = await live(trx, documentId);
            if (op.kind === "add") {
              const at = op.pick % (blocks.length + 1);
              const anchorBlockId = at === 0 ? null : (blocks[at - 1]?.id ?? null);
              await saveHumanEdit(trx, actor, { documentId, change: { op: "add", anchorBlockId, content: para(op.text) } });
            } else if (blocks.length > 0) {
              const blockId = blocks[op.pick % blocks.length]?.id ?? "";
              const change = op.kind === "edit"
                ? { op: "edit" as const, blockId, content: para(op.text) }
                : { op: "remove" as const, blockId };
              await saveHumanEdit(trx, actor, { documentId, change });
            }
          }

          const ids = await proposeRestore(trx, actor, { documentId, versionNumber: 1 });
          if (ids.length > 0) {
            const result = await acceptChanges(trx, actor, { documentId, items: ids.map((changeId) => ({ changeId })) });
            expect(result.stale).toEqual([]);
          }
          expect(await live(trx, documentId)).toEqual(original);
        }),
      ),
      { numRuns: RESTORE_PROPERTY_RUNS },
    );
  });
});

describe("audit trail", () => {
  it("accept ek hi transaction me change.accepted + version.created likhta hai", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { actor, documentId, product } = await setup(trx);
      const [one] = await live(trx, documentId);
      await saveHumanEdit(trx, actor, { documentId, change: { op: "edit", blockId: one?.id ?? "", content: para("x") } });
      const { rows } = await sql<{ action: string }>`
        SELECT action FROM audit_events WHERE product_id = ${product.id} ORDER BY id
      `.execute(trx);
      expect(rows.map((r) => r.action)).toEqual([
        "document.created", "version.created", "change.proposed", "version.created", "change.accepted",
      ]);
    }));
});
