import { infraiFromEnvironment } from "./infrai_client.js";
import { TenantAccounts } from "./tenant_account.js";

const tenantAccounts = new TenantAccounts(infraiFromEnvironment());
const requestId = process.env.DEMO_REQUEST_ID ?? `demo-${Date.now()}`;

const account = await tenantAccounts.onboard({
  requestId,
  email: "chenhua@changba.com",
  name: "River County Food Fund",
  work: ["donor_receipts", "volunteer_reminders", "campaign_reporting"],
});

console.log({
  expected: "tenant user and scoped key created",
  userId: account.userId,
  keyId: account.keyId,
  enabledWork: account.work,
  reminder: "Store account.key now; the plaintext key cannot be retrieved a second time.",
});
