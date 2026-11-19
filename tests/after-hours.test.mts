// Outside open hours the free room answers "after_hours", not "daily_cap".
// Upstash is swapped for a fake (counter far under the cap) and the open hours
// are set so the room is always closed; the SDK is the fake too. No network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { rootUrl } from "./setup.mts";

const FAKE_SDK = new URL("./fake-anthropic.mts", import.meta.url).href;
const FAKE_UPSTASH = new URL("./fake-upstash.mts", import.meta.url).href;
registerHooks({
  resolve: (spec, ctx, next) => {
    if (spec === "@anthropic-ai/sdk") return { url: FAKE_SDK, shortCircuit: true };
    if (spec === "@upstash/ratelimit" || spec === "@upstash/redis") return { url: FAKE_UPSTASH, shortCircuit: true };
    return next(spec, ctx);
  },
});
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.UPSTASH_REDIS_REST_URL = "http://fake";
process.env.UPSTASH_REDIS_REST_TOKEN = "fake";
process.env.FREE_OPEN_HOUR = "24"; // every hour is before opening: closed by the clock

const { POST } = await import(rootUrl("app/api/generate-comp/route.ts"));

test("a closed room says after_hours, not daily_cap, and makes no model call", async () => {
  (globalThis as any).__fake = { calls: [], comp: "{}", repair: "{}" };
  const answers = { q1: "a", q2: "b", q3: "c", q4: "d", q5: "e", q6: "f", q7: "g", q8: "h" };
  const res = await POST(
    new Request("http://localhost/api/generate-comp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
      body: JSON.stringify({ careerText: "Editor at a newspaper, 2015 to 2020.", answers }),
    }),
  );
  assert.equal(res.status, 429);
  assert.equal((await res.json()).reason, "after_hours");
  assert.equal((globalThis as any).__fake.calls.length, 0);
});
