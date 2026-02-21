import type { AppConfig } from "../config.js";
import type { ClinicOpsRepository } from "./clinicOpsRepository.js";
import { CloudflareClinicOpsRepository } from "./cloudflareClinicOpsRepository.js";
import { MemoryClinicOpsRepository } from "./memoryClinicOpsRepository.js";

function hasCloudflareCredentials(config: AppConfig): boolean {
  return Boolean(
    config.cloudflareAccountId &&
      config.cloudflareDatabaseId &&
      config.cloudflareApiToken
  );
}

export function createClinicOpsRepository(config: AppConfig): ClinicOpsRepository {
  if (config.dataBackend === "cloudflare") {
    if (hasCloudflareCredentials(config)) {
      return new CloudflareClinicOpsRepository({
        accountId: config.cloudflareAccountId as string,
        databaseId: config.cloudflareDatabaseId as string,
        apiToken: config.cloudflareApiToken as string,
      });
    }

    console.warn(
      "DATA_BACKEND=cloudflare requested for clinic ops, but CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_D1_DATABASE_ID/CLOUDFLARE_API_TOKEN are missing. Falling back to in-memory repository."
    );
  }

  return new MemoryClinicOpsRepository();
}
