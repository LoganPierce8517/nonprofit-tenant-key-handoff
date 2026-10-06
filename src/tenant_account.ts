import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

const workKinds = ["donor_receipts", "volunteer_reminders", "campaign_reporting"] as const;

export const onboardTenantBody = z.object({
  requestId: z.string().min(8),
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(12).optional(),
  work: z.array(z.enum(workKinds)).min(1),
});

export const offboardTenantBody = z.object({
  userId: z.string().min(1),
  keyId: z.string().min(1),
});

export type TenantAccount = {
  userId: string;
  keyId: string;
  key: string;
  email: string;
  work: (typeof workKinds)[number][];
};

type CreatedUser = { user_id: string };
type CreatedKey = { id: string; key: string };

export class TenantAccounts {
  private readonly infrai: InfraiClient;

  constructor(infrai: InfraiClient) {
    this.infrai = infrai;
  }

  async onboard(input: z.infer<typeof onboardTenantBody>): Promise<TenantAccount> {
    const user = await this.infrai.request<CreatedUser>("POST", "/auth/user/create", {
      email: input.email,
      ...(input.password ? { password: input.password } : {}),
      name: input.name,
      metadata: { nonprofit_work: input.work },
      mode: "tenant",
      idempotency_key: `${input.requestId}:user`,
    });
    const scopedKey = await this.infrai.request<CreatedKey>("POST", "/account/keys/create", {
      name: `${input.name} tenant key`,
      scopes: input.work,
      idempotency_key: `${input.requestId}:key`,
    });

    return {
      userId: user.user_id,
      keyId: scopedKey.id,
      key: scopedKey.key,
      email: input.email,
      work: input.work,
    };
  }

  async offboard(account: z.infer<typeof offboardTenantBody>): Promise<{ deleted: true; revoked: true }> {
    await Promise.all([
      this.infrai.request<unknown>("DELETE", `/auth/user/delete/${encodeURIComponent(account.userId)}`),
      this.infrai.request<unknown>("DELETE", `/account/keys/revoke/${encodeURIComponent(account.keyId)}`),
    ]);
    return { deleted: true, revoked: true };
  }
}
