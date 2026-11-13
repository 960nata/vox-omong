import fs from "fs/promises";
import path from "path";
import type { McpProvider } from "./mcpConnections";

const CREDENTIALS_FILE = path.join(process.cwd(), ".data", "mcp_credentials.json");

export interface StoredMcpCredentials {
  tokens: Partial<Record<McpProvider, string>>;
  customUrls: Partial<Record<McpProvider, string>>;
  updatedAt: string;
}

export const PROVIDER_AUTH_LINKS: Partial<Record<McpProvider, { url: string; label: string; tokenName: string }>> = {
  vercel: {
    url: "https://vercel.com/account/tokens",
    label: "Buat Vercel Personal Access Token",
    tokenName: "VERCEL_TOKEN",
  },
  supabase: {
    url: "https://supabase.com/dashboard/account/tokens",
    label: "Buat Supabase Access Token",
    tokenName: "SUPABASE_ACCESS_TOKEN",
  },
  perplexity: {
    url: "https://www.perplexity.ai/settings/api",
    label: "Ambil Perplexity API Key",
    tokenName: "PERPLEXITY_API_KEY",
  },
  posthog: {
    url: "https://us.posthog.com/settings/project#api-keys",
    label: "Ambil PostHog Project Token",
    tokenName: "POSTHOG_MCP_ACCESS_TOKEN",
  },
  composio: {
    url: "https://app.composio.dev/settings",
    label: "Daftar & Ambil Composio API Key",
    tokenName: "COMPOSIO_CONSUMER_API_KEY",
  },
};

export async function loadMcpCredentials(): Promise<StoredMcpCredentials> {
  try {
    const raw = await fs.readFile(CREDENTIALS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      tokens: {},
      customUrls: {},
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function saveMcpCredentials(creds: StoredMcpCredentials): Promise<void> {
  await fs.mkdir(path.dirname(CREDENTIALS_FILE), { recursive: true });
  creds.updatedAt = new Date().toISOString();
  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), "utf-8");
}

export async function getMcpCredential(provider: McpProvider): Promise<{ token?: string; customUrl?: string }> {
  const creds = await loadMcpCredentials();
  return {
    token: creds.tokens[provider],
    customUrl: creds.customUrls[provider],
  };
}

export async function setMcpCredential(
  provider: McpProvider,
  opts: { token?: string; customUrl?: string }
): Promise<void> {
  const creds = await loadMcpCredentials();
  if (opts.token !== undefined) {
    if (opts.token.trim()) creds.tokens[provider] = opts.token.trim();
    else delete creds.tokens[provider];
  }
  if (opts.customUrl !== undefined) {
    if (opts.customUrl.trim()) creds.customUrls[provider] = opts.customUrl.trim();
    else delete creds.customUrls[provider];
  }
  await saveMcpCredentials(creds);
}

export async function removeMcpCredential(provider: McpProvider): Promise<void> {
  const creds = await loadMcpCredentials();
  delete creds.tokens[provider];
  delete creds.customUrls[provider];
  await saveMcpCredentials(creds);
}
