/**
 * DRIFT TEST (ADR 0021): DB ke CHECK constraints aur TS value lists hamesha same rahein.
 *
 * "Value-list constraint" = `CHECK (col IN ('a','b'))`. Postgres ise do shapes me store karta hai:
 *   kai values: ((role = ANY (ARRAY['owner'::text, 'reviewer'::text, 'viewer'::text])))
 *   ek value:   ((plan = 'free'::text))
 * Baaki CHECKs (jaise `email = lower(btrim(email))`) is pattern me nahi aate, isliye ignore hote hain.
 */
import { readFileSync } from "node:fs";
import { sql } from "kysely";
import { afterAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createAdminTestDb } from "./testing/db.ts";
import { VALUE_LISTS } from "./value-lists.ts";

const db = createAdminTestDb();
afterAll(() => db.destroy());

const VALUE_LIST_CHECK = /^CHECK \(\((\w+) = (ANY \(ARRAY\[(.+)\]\)|'[^']*'::text)\)\)$/;
const TEXT_LITERAL = /'((?:[^']|'')*)'::text/g;

/** DB se saare value-list constraints: "table.column" → sorted values. */
async function readDbValueLists(): Promise<Record<string, string[]>> {
  const { rows } = await sql<{ table_name: string; definition: string }>`
    SELECT rel.relname AS table_name, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint AS con
    JOIN pg_class AS rel ON rel.oid = con.conrelid
    JOIN pg_namespace AS nsp ON nsp.oid = rel.relnamespace
    WHERE con.contype = 'c' AND nsp.nspname = 'public'
  `.execute(db);

  const lists: Record<string, string[]> = {};
  for (const { table_name, definition } of rows) {
    const match = VALUE_LIST_CHECK.exec(definition);
    if (!match) continue;
    const values = [...definition.matchAll(TEXT_LITERAL)].map((m) => (m[1] ?? "").replaceAll("''", "'"));
    lists[`${table_name}.${match[1]}`] = values.sort();
  }
  return lists;
}

describe("value lists drift test", () => {
  it("DB ka har value-list CHECK constraint TS VALUE_LISTS se exactly match karta hai", async () => {
    const fromDb = await readDbValueLists();
    const fromTs = Object.fromEntries(
      Object.entries(VALUE_LISTS).map(([key, values]) => [key, [...values].sort()]),
    );
    // Ek hi assertion: missing key, extra key, ya alag values, teeno yahin pakde jaate hain.
    expect(fromTs).toEqual(fromDb);
  });

  it("codegen config me har list ka override hai (warna generated type `string` reh jaata)", () => {
    const configSchema = z.object({ overrides: z.object({ columns: z.record(z.string(), z.string()) }) });
    const config = configSchema.parse(
      JSON.parse(readFileSync(new URL("../.kysely-codegenrc.json", import.meta.url), "utf8")),
    );
    expect(Object.keys(config.overrides.columns).sort()).toEqual(Object.keys(VALUE_LISTS).sort());
  });
});
