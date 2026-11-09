/**
 * Kysely client (ADR 0008, 0020): `pg` (node-postgres) Pool ke upar type-safe query builder.
 */
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { DB } from "./generated/database.ts";

export type Database = Kysely<DB>;

export interface CreateDbOptions {
  /** Postgres URL. App me ye hamesha `marky_app` ka URL hota hai (DATABASE_URL), admin ka kabhi nahi. */
  connectionString: string;
  /**
   * Pool me max kitne connections. Na do to `pg` ka apna default lagta hai.
   * App ka asli value tunables se aayega (ye faisla app/worker step me hoga).
   */
  maxConnections?: number;
}

export function createDb({ connectionString, maxConnections }: CreateDbOptions): Database {
  const pool = new pg.Pool(
    maxConnections === undefined ? { connectionString } : { connectionString, max: maxConnections },
  );
  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}
