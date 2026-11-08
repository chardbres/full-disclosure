import "server-only";
import postgres, { type Sql } from "postgres";

const globalForDb = globalThis as typeof globalThis & { sql?: Sql };

// One connection pool per server instance, kept on globalThis so hot reloads
// in development don't open a new pool each time.
export function db(): Sql {
  if (!globalForDb.sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "Set DATABASE_URL to a read-only Postgres connection string (see .env.example)",
      );
    }
    globalForDb.sql = postgres(url, {
      // Supabase's transaction pooler can't keep prepared statements
      prepare: false,
      // Serverless functions handle one request at a time
      max: 1,
    });
  }
  return globalForDb.sql;
}
