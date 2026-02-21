import type { DataBackend } from "./domain.js";

export interface AppConfig {
  serverName: string;
  serverTitle: string;
  serverDescription: string;
  baseUrl: string;
  websiteUrl: string;
  dataBackend: DataBackend;
  cloudflareAccountId?: string;
  cloudflareDatabaseId?: string;
  cloudflareApiToken?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  dentalImageModel?: string;
  phiEncryptionKey?: string;
  requirePurposeOnSensitiveReads: boolean;
}

function normalizeDataBackend(value: string | undefined): DataBackend {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "cloudflare" || normalized === "cloudflare-d1") {
    return "cloudflare";
  }
  return "memory";
}

function normalizeBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function loadConfig(): AppConfig {
  return {
    serverName: process.env.MCP_SERVER_NAME || "dentropic",
    serverTitle: process.env.MCP_SERVER_TITLE || "Dental MCP",
    serverDescription:
      process.env.MCP_SERVER_DESCRIPTION ||
      "Dental operations MCP server with Cloudflare and dental imagery processing",
    baseUrl: process.env.MCP_URL || "http://localhost:3000",
    websiteUrl: process.env.MCP_WEBSITE_URL || "https://manufact.com/docs/home",
    dataBackend: normalizeDataBackend(process.env.DATA_BACKEND),
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareDatabaseId: process.env.CLOUDFLARE_D1_DATABASE_ID,
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_API_BASE_URL,
    dentalImageModel: process.env.DENTAL_IMAGE_MODEL,
    phiEncryptionKey: process.env.PHI_ENCRYPTION_KEY,
    requirePurposeOnSensitiveReads: normalizeBoolean(
      process.env.REQUIRE_PURPOSE_ON_SENSITIVE_READS,
      true
    ),
  };
}
