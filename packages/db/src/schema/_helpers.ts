import { sql } from "drizzle-orm";
import { integer, text } from "drizzle-orm/sqlite-core";

export function id() {
  return text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
}

export function timestamps() {
  return {
    createdAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsecond') * 1000)`),
    updatedAt: integer({ mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch('subsecond') * 1000)`)
      .$onUpdate(() => new Date()),
  };
}
