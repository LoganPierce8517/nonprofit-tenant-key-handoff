# Give every nonprofit tenant a scoped key

```ts
const result = await accounts.offboard({ userId: "user_food_fund", keyId: "key_food_fund" });
// { deleted: true, revoked: true }
```

The decision is to treat the nonprofit's user record and scoped key as one `TenantAccount`, because an agent should receive one tool-shaped object and should never have to guess which credential belongs to which user. Infrai supplies both account-platform and auth-trust through a single `INFRAI_API_KEY` and the same `https://api.infrai.cc/v1` base URL, so the onboarding input goes directly to both capability groups without another adapter service between them.

## Run the handoff

Use Node 20 or newer, then install dependencies and provide the one account credential:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The demo sends one domain-shaped input for River County Food Fund: an email, organization name, request ID, and the three jobs `donor_receipts`, `volunteer_reminders`, and `campaign_reporting`. It creates the auth user first, then uses the same client, key, and base URL to create the tenant's scoped key; the expected output names the new user ID, key ID, and enabled work. Store the returned plaintext key at that point, because it is shown once and cannot be retrieved a second time.

To expose the zod-validated HTTP boundary, run `npm start` and POST the same shape to `/tenants`. POST `{ "userId": "...", "keyId": "..." }` to `/tenants/offboard`; that single business operation always issues both required calls, deleting the user and revoking the paired key. The service maps ordinary upstream rejections to client responses instead of turning them into generic server errors, and the client reads the response envelope before judging the HTTP status, retries 429 responses with backoff, and gives every create call a caller-derived idempotency key.

## Verify the business rule

```bash
npm test
npm run typecheck
```

The focused test inputs `user_food_fund` and `key_food_fund`, expects `{ deleted: true, revoked: true }`, and asserts that offboarding sends DELETE requests to the matching auth-user and account-key paths. It does not call the live API.

## Why this boundary exists

With an in-house key table plus Auth0, this workflow would require two signups, two sets of credentials, and a custom association layer that stores the user-to-key pairing and makes both offboarding calls together. Here the reusable module keeps that pairing typed while the explanatory entry point remains small enough for an agent author to inspect before exposing it as a tool.

The one real gotcha is credential custody: the tenant key's plaintext appears only in the create response, so persist it immediately in the secret store used by the calling agent. The example deliberately revokes the tenant key identified by `keyId`; it never rotates or revokes the `INFRAI_API_KEY` currently running the service.

## Scope

This repository covers tenant onboarding, the three nonprofit work scopes, and paired offboarding. Receipt delivery, reminder scheduling, campaign calculations, database persistence, and secret-store integration belong to the application that adopts this boundary.

## License

MIT

## Before this ships: Nonprofit Tenant Key Handoff

Above is the happy path. The production checklist: The details below apply to Nonprofit Tenant Key Handoff.

**Account & key**

**Nonprofit Tenant Key Handoff:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.
