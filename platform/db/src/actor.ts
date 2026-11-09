/**
 * ACTOR + RLS context (ADR 0018).
 *
 * Har request ka DB kaam ek transaction me hota hai jiske shuru me DB ko batate hain:
 *   1. `SET LOCAL ROLE marky_user`             -> kaunse GRANTs lagenge
 *   2. `set_config('app.actor', <json>, true)` -> RLS policies kis user ke hisaab se rows filter karein
 * Dono "LOCAL" hain, to transaction khatam hote hi mit jaate hain. Pool me connection wapas jaane par agli request
 * ko purana user kabhi nahi milta.
 */
import { sql, type Kysely, type Transaction } from "kysely";
import type { DB } from "./generated/database.ts";

/** Request kaun kar raha hai. Guest (share link) actor sharing step me jodenge (ADR 0018). */
export type Actor = { kind: "user"; id: string };

/**
 * Actor kind → Postgres role. Role ke naam ka source of truth migration
 * `20261109130834_roles_and_app_schema.sql` hai; naam wahan badle to yahan bhi badlo.
 */
export const ACTOR_DB_ROLES = {
  user: "marky_user",
} as const satisfies Record<Actor["kind"], string>;

/** Ek chal rahe transaction par actor lagao. Tests isse seedha use karte hain; app `withActor` use kare. */
export async function applyActor(trx: Transaction<DB>, actor: Actor): Promise<void> {
  // Role ka naam identifier hai (value nahi), isliye `sql.id` se properly quote hota hai. Ye injection-safe hai.
  await sql`SET LOCAL ROLE ${sql.id(ACTOR_DB_ROLES[actor.kind])}`.execute(trx);
  // Actor JSON ek parameter ($1) ke roop me jaata hai, string jod kar nahi. Isliye SQL injection possible nahi.
  await sql`SELECT set_config('app.actor', ${JSON.stringify(actor)}, true)`.execute(trx);
}

/** Naya transaction kholo, actor lagao, `fn` chalao, commit karo. `fn` throw kare to rollback. */
export function withActor<T>(
  db: Kysely<DB>,
  actor: Actor,
  fn: (trx: Transaction<DB>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await applyActor(trx, actor);
    return fn(trx);
  });
}
