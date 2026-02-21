import type { AppConfig } from "../config.js";
import type { DentalStore } from "./types.js";
import { CloudflareD1Store } from "./cloudflareD1Store.js";
import { MemoryDentalStore } from "./memoryStore.js";

function hasCloudflareCredentials(config: AppConfig): boolean {
  return Boolean(
    config.cloudflareAccountId &&
      config.cloudflareDatabaseId &&
      config.cloudflareApiToken
  );
}

export function createDentalStore(config: AppConfig): DentalStore {
  if (config.dataBackend === "cloudflare") {
    if (hasCloudflareCredentials(config)) {
      return new CloudflareD1Store({
        accountId: config.cloudflareAccountId as string,
        databaseId: config.cloudflareDatabaseId as string,
        apiToken: config.cloudflareApiToken as string,
      });
    }

    console.warn(
      "DATA_BACKEND=cloudflare requested, but CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_D1_DATABASE_ID/CLOUDFLARE_API_TOKEN are missing. Falling back to in-memory storage."
    );
  }

  return new MemoryDentalStore();
}
