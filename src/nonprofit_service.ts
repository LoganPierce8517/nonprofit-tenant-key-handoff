import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError, type ZodType } from "zod";
import { InfraiError, infraiFromEnvironment } from "./infrai_client.js";
import { offboardTenantBody, onboardTenantBody, TenantAccounts } from "./tenant_account.js";

const accounts = new TenantAccounts(infraiFromEnvironment());
const port = Number(process.env.PORT ?? 3000);

async function body<T>(request: IncomingMessage, schema: ZodType<T>): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/tenants") {
      const result = await accounts.onboard(await body(request, onboardTenantBody));
      json(response, 201, result);
      return;
    }
    if (request.method === "POST" && request.url === "/tenants/offboard") {
      json(response, 200, await accounts.offboard(await body(request, offboardTenantBody)));
      return;
    }
    json(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "Invalid request body" });
    } else if (error instanceof InfraiError) {
      json(response, error.status >= 400 && error.status < 500 ? error.status : 502, {
        error: error.code,
        details: error.details,
      });
    } else {
      json(response, 502, { error: "Upstream request did not complete" });
    }
  }
}).listen(port, () => console.log(`Nonprofit tenant service listening on http://localhost:${port}`));
