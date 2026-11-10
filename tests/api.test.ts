// @vitest-environment node
// The report route's input checks. Every request here is refused with a 400
// before any limit check or model call, so nothing is spent.
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/generate-comp/route";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/generate-comp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("report API checks (no model call)", () => {
  it("rejects an empty request with 400", async () => {
    const res = await post({ careerText: "", answers: {} });
    expect(res.status).toBe(400);
  });

  it("rejects a resume with too few quiz answers with 400", async () => {
    const res = await post({ careerText: "Ten years as an editor.", answers: { q1: "a" } });
    expect(res.status).toBe(400);
  });

  it("rejects a body that is not JSON with 400", async () => {
    const res = await post("not json");
    expect(res.status).toBe(400);
  });
});
