import { getTableColumns, sql, type SQLWrapper } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getDb } from "./index";

// Aggregate each child relation before joining it, so independent 1:N tables
// cannot multiply one another's rows. Reuse column decoders for dates and JSON.
export function joinedRows<T extends PgTable, A extends string>(
  table: T,
  query: SQLWrapper | undefined,
  alias: A,
) {
  const columns = Object.entries(getTableColumns(table));
  const rows = sql<T["$inferSelect"][]>`coalesce(jsonb_agg(to_jsonb(data_rows) order by data_rows.__position), '[]'::jsonb)`
    .mapWith((value: unknown): T["$inferSelect"][] => {
      const records = (typeof value === "string" ? JSON.parse(value) : value) as Record<string, unknown>[];
      return records.map(record => Object.fromEntries(columns.map(([key, column]) => [
        key, record[column.name] === null ? null : column.mapFromDriverValue(record[column.name]),
      ])) as T["$inferSelect"]);
    }).as(`${alias}_data`);
  // Keep the query's existing ORDER BY and LIMIT before aggregation.
  const source = query ?? sql`select null where false`;
  return getDb().select({ rows })
    .from(sql`(select ordered_rows.*, row_number() over () as __position from (${source}) ordered_rows) data_rows`)
    .as(alias);
}
