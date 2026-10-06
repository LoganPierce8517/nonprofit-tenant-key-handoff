import assert from "node:assert/strict";
import test from "node:test";
import { InfraiClient, type RequestLog } from "../src/infrai_client.js";
import { TenantAccounts } from "../src/tenant_account.js";

test("offboarding always targets the paired user and scoped key", async () => {
  const calls: RequestLog[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ method: String(init?.method), path: new URL(String(input)).pathname });
    return new Response(JSON.stringify({ ok: true, data: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const accounts = new TenantAccounts(new InfraiClient("test-key", fetcher));

  const result = await accounts.offboard({ userId: "user_food_fund", keyId: "key_food_fund" });

  assert.deepEqual(result, { deleted: true, revoked: true });
  assert.deepEqual(calls, [
    { method: "DELETE", path: "/v1/auth/user/delete/user_food_fund" },
    { method: "DELETE", path: "/v1/account/keys/revoke/key_food_fund" },
  ]);
});
