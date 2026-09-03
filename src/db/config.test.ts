import { describe, expect, it } from "vitest";

import { databaseClientOptions } from "./index";

describe("databaseClientOptions", () => {
  it("uses one connection and disables prepared statements for the Supabase pooler", () => {
    expect(
      databaseClientOptions(
        "postgresql://postgres.example:secret@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres",
      ),
    ).toMatchObject({ max: 1, prepare: false });
  });

  it("keeps prepared statements for a direct PostgreSQL connection", () => {
    expect(
      databaseClientOptions("postgresql://mobile:secret@localhost:5432/mobile"),
    ).toMatchObject({ max: 1, prepare: true });
  });
});
