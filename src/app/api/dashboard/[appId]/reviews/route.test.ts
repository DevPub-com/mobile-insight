import { beforeEach, describe, expect, it, vi } from "vitest";
import { getReviewPage } from "@/db/review.repository";
import { GET } from "./route";
vi.mock("@/db/review.repository", () => ({ getReviewPage: vi.fn() }));
const context = { params: Promise.resolve({ appId: "kis" }) };
beforeEach(() => vi.resetAllMocks());
describe("review page query contract", () => {
  it.each(["page=abc", "page=0", "pageSize=5000", "platform=web", "period=wrong", "rating=7", "cursor=bad", "from=2026-09-01", "from=2026-02-30&to=2026-03-01", "from=2026-09-19&to=2026-09-18", "keyword=%7B%7D"])("rejects %s before querying the DB", async query => {
    const response = await GET(new Request(`https://example.test/api/dashboard/kis/reviews?${query}`), context);
    expect(response.status).toBe(400);
    expect(getReviewPage).not.toHaveBeenCalled();
  });
  it("preserves the page contract and includes complete total and next cursor", async () => {
    const result = { data: [], pagination: { page: 1, pageSize: 10, total: 6000, totalPages: 600, nextCursor: "next" } };
    vi.mocked(getReviewPage).mockResolvedValue(result);
    const response = await GET(new Request("https://example.test/api/dashboard/kis/reviews"), context);
    expect(await response.json()).toEqual(result);
    expect(getReviewPage).toHaveBeenCalledWith("kis", expect.objectContaining({ page: 1, period: "30d" }));
  });
});
