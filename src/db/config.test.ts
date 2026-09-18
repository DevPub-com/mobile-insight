import { describe, expect, it } from "vitest";

import { databaseClientOptions } from "./index";

describe("databaseClientOptions", () => {
  it("limits each Supabase pool to one short-lived connection without prepared statements", () => {
    expect(
      databaseClientOptions(
        "postgresql://postgres.example:secret@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres",
      ),
    ).toMatchObject({ max: 1, idle_timeout: 5, prepare: false });
  });

  it("keeps prepared statements for a direct PostgreSQL connection", () => {
    expect(
      databaseClientOptions("postgresql://mobile:secret@localhost:5432/mobile"),
    ).toMatchObject({ max: 8, prepare: true });
  });
});
