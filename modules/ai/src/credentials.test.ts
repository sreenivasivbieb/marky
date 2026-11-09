/**
 * BYOK key security tests (ADR 0025, NFR-21). Asli Postgres, har test rollback.
 */
import { randomBytes } from "node:crypto";
import { applyActor } from "@marky/db";
import {
  createAdminTestDb, createProductAs, expectDbError, inRolledBackTransaction, PG_ERROR, resetToAdmin, seedUser, userActor,
} from "@marky/db/testing";
import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import {
  AiCredentialError, getAiCredentialInfo, keyHint, loadAiCredential, removeAiCredential, setAiCredential, suggestProvider,
} from "./credentials.ts";

const db = createAdminTestDb();
afterAll(() => db.destroy());

const masterKey = randomBytes(32);
const FAKE_KEY = "sk-ant-api03-FAKE-TEST-KEY-not-real-9z8y";

async function ownerWithProduct(trx: Parameters<Parameters<typeof inRolledBackTransaction>[1]>[0]) {
  const alice = await seedUser(trx, "Alice");
  const product = await createProductAs(trx, alice, "Alpha");
  await applyActor(trx, userActor(alice));
  return { alice, product, actor: userActor(alice) };
}

describe("helpers", () => {
  it("key prefix se provider ka sujhaav", () => {
    expect(suggestProvider("sk-ant-abc")).toBe("anthropic");
    expect(suggestProvider("sk-proj-abc")).toBe("openai");
    expect(suggestProvider("AIzaSyabc")).toBe("google");
    expect(suggestProvider("random")).toBeNull();
  });

  it("hint sirf aakhri 4 characters", () => {
    expect(keyHint(FAKE_KEY)).toBe("…9z8y");
  });
});

describe("owner key set / load", () => {
  it("owner set karta hai → info me sirf hint; server-side load par asli key", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { product, actor } = await ownerWithProduct(trx);
      await setAiCredential(trx, actor, { productId: product.id, provider: "anthropic", model: "claude-x", apiKey: FAKE_KEY }, masterKey);

      const info = await getAiCredentialInfo(trx, product.id);
      expect(info).toMatchObject({ provider: "anthropic", model: "claude-x", keyHint: "…9z8y" });
      expect(JSON.stringify(info)).not.toContain(FAKE_KEY);

      expect(await loadAiCredential(trx, product.id, masterKey)).toEqual({
        provider: "anthropic", model: "claude-x", apiKey: FAKE_KEY,
      });
    }));

  it("replace karne par nayi key; audit me provider/hint hai, key kabhi nahi", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { product, actor } = await ownerWithProduct(trx);
      const input = { productId: product.id, provider: "openai", model: "gpt-x" };
      await setAiCredential(trx, actor, { ...input, apiKey: "sk-first-key-1111" }, masterKey);
      await setAiCredential(trx, actor, { ...input, apiKey: FAKE_KEY }, masterKey);
      expect((await loadAiCredential(trx, product.id, masterKey))?.apiKey).toBe(FAKE_KEY);

      const audit = await trx.selectFrom("audit_events").select(["action", "metadata"])
        .where("product_id", "=", product.id).where("target_type", "=", "ai_credential").orderBy("id").execute();
      expect(audit.map((a) => a.action)).toEqual(["ai_credential.set", "ai_credential.set"]);
      expect(JSON.stringify(audit)).not.toContain(FAKE_KEY);
      expect(JSON.stringify(audit)).not.toContain("sk-first-key");
    }));

  it("DB me plaintext key kahin nahi (admin bhi poori table padhe to)", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { product, actor } = await ownerWithProduct(trx);
      await setAiCredential(trx, actor, { productId: product.id, provider: "anthropic", model: "m", apiKey: FAKE_KEY }, masterKey);
      await resetToAdmin(trx);
      const { rows } = await sql<{ dump: string }>`SELECT row_to_json(c)::text AS dump FROM ai_credentials c`.execute(trx);
      expect(rows.map((r) => r.dump).join()).not.toContain("FAKE-TEST-KEY");
    }));

  it("galat input reject; error me key nahi", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { product, actor } = await ownerWithProduct(trx);
      const attempt = setAiCredential(trx, actor, { productId: product.id, provider: "skynet", model: "m", apiKey: FAKE_KEY }, masterKey);
      await expect(attempt).rejects.toSatisfy((e: unknown) =>
        e instanceof AiCredentialError && e.code === "invalid_input" && !e.message.includes(FAKE_KEY));
    }));

  it("remove ke baad key nahi milti", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { product, actor } = await ownerWithProduct(trx);
      await setAiCredential(trx, actor, { productId: product.id, provider: "google", model: "g", apiKey: "AIza-fake-123456" }, masterKey);
      expect(await removeAiCredential(trx, actor, product.id)).toBe(true);
      expect(await getAiCredentialInfo(trx, product.id)).toBeNull();
      expect(await loadAiCredential(trx, product.id, masterKey)).toBeNull();
    }));
});

describe("sirf Owner (NFR-21)", () => {
  it("reviewer na hint dekh sakta, na key load kar sakta, na badal sakta", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { product, actor } = await ownerWithProduct(trx);
      await setAiCredential(trx, actor, { productId: product.id, provider: "anthropic", model: "m", apiKey: FAKE_KEY }, masterKey);
      await resetToAdmin(trx);
      const bob = await seedUser(trx, "Bob");
      await trx.insertInto("memberships").values({ product_id: product.id, user_id: bob.id, role: "reviewer" }).execute();
      await applyActor(trx, userActor(bob));

      expect(await getAiCredentialInfo(trx, product.id)).toBeNull();
      expect(await loadAiCredential(trx, product.id, masterKey)).toBeNull();
      const code = await expectDbError(trx, () =>
        setAiCredential(trx, userActor(bob), { productId: product.id, provider: "openai", model: "m", apiKey: "sk-bob" }, masterKey));
      expect(code).toBe(PG_ERROR.insufficientPrivilege);
    }));

  it("owner bhi ciphertext column SELECT nahi kar sakta (GRANT hi nahi)", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { product, actor } = await ownerWithProduct(trx);
      await setAiCredential(trx, actor, { productId: product.id, provider: "anthropic", model: "m", apiKey: FAKE_KEY }, masterKey);
      const code = await expectDbError(trx, () => sql`SELECT key_ciphertext FROM ai_credentials`.execute(trx));
      expect(code).toBe(PG_ERROR.insufficientPrivilege);
    }));
});

describe("ciphertext binding (AAD)", () => {
  it("ek product ka ciphertext doosre product me copy karo → decrypt fail (decrypt_failed), key leak nahi", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { alice, product, actor } = await ownerWithProduct(trx);
      await setAiCredential(trx, actor, { productId: product.id, provider: "anthropic", model: "m", apiKey: FAKE_KEY }, masterKey);
      const beta = await createProductAs(trx, alice, "Beta");
      await setAiCredential(trx, actor, { productId: beta.id, provider: "anthropic", model: "m", apiKey: "sk-ant-beta-0000" }, masterKey);

      await resetToAdmin(trx);
      await sql`UPDATE ai_credentials AS b SET key_ciphertext = a.key_ciphertext, key_iv = a.key_iv, key_auth_tag = a.key_auth_tag
                FROM ai_credentials AS a WHERE a.product_id = ${product.id} AND b.product_id = ${beta.id}`.execute(trx);
      await applyActor(trx, actor);

      await expect(loadAiCredential(trx, beta.id, masterKey)).rejects.toSatisfy((e: unknown) =>
        e instanceof AiCredentialError && e.code === "decrypt_failed" && !e.message.includes(FAKE_KEY));
    }));

  it("galat master key (jaise rotation gadbad) par decrypt_failed", () =>
    inRolledBackTransaction(db, async (trx) => {
      const { product, actor } = await ownerWithProduct(trx);
      await setAiCredential(trx, actor, { productId: product.id, provider: "anthropic", model: "m", apiKey: FAKE_KEY }, masterKey);
      await expect(loadAiCredential(trx, product.id, randomBytes(32))).rejects.toBeInstanceOf(AiCredentialError);
    }));
});
