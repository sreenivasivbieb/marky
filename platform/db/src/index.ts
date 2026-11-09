/**
 * @marky/db: public API. Doosre packages sirf yahan se import karein.
 */
export { ACTOR_DB_ROLES, applyActor, withActor, type Actor } from "./actor.ts";
export { createDb, type CreateDbOptions, type Database } from "./client.ts";
export type { DB } from "./generated/database.ts";
// Saari allowed-value lists aur unke types (DB CHECK constraints ka TS mirror, ADR 0021).
export * from "./value-lists.ts";
