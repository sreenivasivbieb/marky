/**
 * TEAM KI AI API KEY (BYOK, ADR 0025 / 0027).
 *
 * Niyam (user ke):
 *   - key encrypted store (AES-256-GCM, @marky/crypto); DB me sirf ciphertext,
 *   - key kabhi log, error message, audit metadata ya browser tak nahi; bahar sirf masked hint ("…a1b2"),
 *   - sirf Owner set / replace / delete / use kare (RLS + SECURITY DEFINER function).
 * `loadAiCredential` decrypted key lautata hai: ye SIRF server-side model gateway ke liye hai, kabhi API response me nahi.
 */
import { AI_PROVIDERS, type Actor, type AiProvider, type DB } from "@marky/db";
import { openSecret, sealSecret, SecretBoxError } from "@marky/crypto";
import { sql, type Transaction } from "kysely";

type Tx = Transaction<DB>;

/** Hint me key ke aakhri kitne characters dikhte hain. */
export const KEY_HINT_CHARS = 4;
/** Abhi ki master key ka version (rotation ke time badhega). */
export const CURRENT_KEY_VERSION = 1;

/** Key prefix se provider ka SIRF sujhaav (owner ka chunav final hai). Order zaroori: "sk-ant-" pehle, "sk-" baad me. */
const PROVIDER_KEY_PREFIXES: readonly (readonly [string, AiProvider])[] = [
  ["sk-ant-", "anthropic"],
  ["AIza", "google"],
  ["sk-", "openai"],
];

export const AI_CREDENTIAL_ERROR_CODES = ["invalid_input", "decrypt_failed"] as const;
export type AiCredentialErrorCode = (typeof AI_CREDENTIAL_ERROR_CODES)[number];

/** Message me kabhi key ya uska hissa nahi hota. */
export class AiCredentialError extends Error {
  readonly code: AiCredentialErrorCode;
  constructor(code: AiCredentialErrorCode, message: string) {
    super(message);
    this.name = "AiCredentialError";
    this.code = code;
  }
}

export function suggestProvider(apiKey: string): AiProvider | null {
  const key = apiKey.trim();
  return PROVIDER_KEY_PREFIXES.find(([prefix]) => key.startsWith(prefix))?.[1] ?? null;
}

export function keyHint(apiKey: string): string {
  return `…${apiKey.trim().slice(-KEY_HINT_CHARS)}`;
}

/** AAD: ciphertext ko product + key version se baandhta hai (copy karke doosre product me decrypt nahi hoga). */
function associatedData(productId: string, keyVersion: number): string {
  return `ai_credential:${productId}:v${keyVersion}`;
}

function isProvider(value: string): value is AiProvider {
  return (AI_PROVIDERS as readonly string[]).includes(value);
}

export interface AiCredentialInput {
  productId: string;
  provider: string;
  model: string;
  apiKey: string;
}

export interface AiCredentialInfo {
  provider: AiProvider;
  model: string;
  keyHint: string;
  updatedAt: Date;
}

export async function setAiCredential(
  trx: Tx,
  actor: Actor,
  input: AiCredentialInput,
  masterKey: Buffer,
): Promise<void> {
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();
  if (!isProvider(input.provider)) throw new AiCredentialError("invalid_input", "unknown AI provider");
  if (model === "") throw new AiCredentialError("invalid_input", "model must not be empty");
  if (apiKey === "" || /\s/.test(apiKey)) throw new AiCredentialError("invalid_input", "API key looks invalid");

  const sealed = sealSecret(apiKey, masterKey, associatedData(input.productId, CURRENT_KEY_VERSION));
  const values = {
    provider: input.provider,
    model,
    key_ciphertext: sealed.ciphertext,
    key_iv: sealed.iv,
    key_auth_tag: sealed.authTag,
    key_version: CURRENT_KEY_VERSION,
    key_hint: keyHint(apiKey),
    updated_by: actor.id,
    updated_at: sql<Date>`now()`,
  };

  // Upsert ko UPDATE-phir-INSERT me tod kar likha hai: `ON CONFLICT DO UPDATE` ko ciphertext columns ka SELECT
  // privilege chahiye hota, jo jaan-boojh kar kisi ko nahi diya (ADR 0025).
  const updated = await trx.updateTable("ai_credentials").set(values)
    .where("product_id", "=", input.productId).executeTakeFirst();
  const replaced = updated.numUpdatedRows > 0n;
  if (!replaced) {
    await trx.insertInto("ai_credentials").values({ product_id: input.productId, ...values }).execute();
  }

  await trx.insertInto("audit_events").values({
    product_id: input.productId, actor_type: "user", actor_id: actor.id,
    action: "ai_credential.set", target_type: "ai_credential", target_id: input.productId,
    metadata: { provider: input.provider, model, keyHint: values.key_hint, replaced }, // key kabhi nahi
  }).execute();
}

export async function removeAiCredential(trx: Tx, actor: Actor, productId: string): Promise<boolean> {
  const deleted = await trx.deleteFrom("ai_credentials").where("product_id", "=", productId).executeTakeFirst();
  if (deleted.numDeletedRows === 0n) return false;
  await trx.insertInto("audit_events").values({
    product_id: productId, actor_type: "user", actor_id: actor.id,
    action: "ai_credential.removed", target_type: "ai_credential", target_id: productId,
  }).execute();
  return true;
}

/** Settings screen ke liye: provider, model, masked hint. Non-owner ko `null` (RLS). */
export async function getAiCredentialInfo(trx: Tx, productId: string): Promise<AiCredentialInfo | null> {
  const row = await trx.selectFrom("ai_credentials")
    .select(["provider", "model", "key_hint", "updated_at"])
    .where("product_id", "=", productId)
    .executeTakeFirst();
  return row ? { provider: row.provider, model: row.model, keyHint: row.key_hint, updatedAt: row.updated_at } : null;
}

/**
 * SERVER-ONLY: decrypted key + provider + model, model gateway ke liye. Owner na ho ya key na ho to `null`.
 * Ye value kabhi log ya HTTP response me nahi jaani chahiye.
 */
export async function loadAiCredential(
  trx: Tx,
  productId: string,
  masterKey: Buffer,
): Promise<{ provider: AiProvider; model: string; apiKey: string } | null> {
  const { rows } = await sql<{
    provider: AiProvider; model: string; key_ciphertext: Buffer; key_iv: Buffer; key_auth_tag: Buffer; key_version: number;
  }>`SELECT * FROM app.ai_credential_secret(${productId})`.execute(trx);
  const row = rows[0];
  if (!row) return null;
  try {
    const apiKey = openSecret(
      { ciphertext: row.key_ciphertext, iv: row.key_iv, authTag: row.key_auth_tag },
      masterKey,
      associatedData(productId, row.key_version),
    );
    return { provider: row.provider, model: row.model, apiKey };
  } catch (error) {
    if (error instanceof SecretBoxError) {
      throw new AiCredentialError("decrypt_failed", "stored AI key could not be decrypted; the owner must enter it again");
    }
    throw error;
  }
}
