import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import fsSync from "fs";
import path from "path";
import { PROVIDER_AUTH_LINKS } from "./mcpCredentials";

export const MCP_PROVIDERS = ["perplexity", "firecrawl", "posthog", "playwright", "composio", "supabase", "vercel", "chrome-devtools"] as const;
export type McpProvider = (typeof MCP_PROVIDERS)[number];

export const MCP_CATALOG: Record<McpProvider, { name: string; purpose: string; docs: string; env: string }> = {
  perplexity: { name: "Perplexity", purpose: "Riset dan pencarian web", docs: "https://github.com/perplexityai/modelcontextprotocol", env: "PERPLEXITY_API_KEY" },
  firecrawl: { name: "Firecrawl", purpose: "Baca dan ekstrak website", docs: "https://docs.firecrawl.dev/mcp-server", env: "FIRECRAWL_API_KEY" },
  posthog: { name: "PostHog", purpose: "Analitik, error, dan produk", docs: "https://posthog.com/docs/model-context-protocol", env: "POSTHOG_MCP_ACCESS_TOKEN" },
  playwright: { name: "Playwright MCP", purpose: "Buka dan periksa halaman browser", docs: "https://github.com/microsoft/playwright-mcp", env: "PLAYWRIGHT_MCP_URL" },
  composio: { name: "Composio", purpose: "Aplikasi yang terhubung ke akun", docs: "https://docs.composio.dev/docs/composio-connect", env: "COMPOSIO_CONSUMER_API_KEY" },
  supabase: { name: "Supabase", purpose: "Skema database, tabel, dan migrasi", docs: "https://github.com/supabase/mcp", env: "SUPABASE_ACCESS_TOKEN" },
  vercel: { name: "Vercel", purpose: "Status deployment, proyek, dan log build", docs: "https://vercel.com/docs/mcp/vercel-mcp", env: "VERCEL_TOKEN" },
  "chrome-devtools": { name: "Chrome DevTools", purpose: "Inspeksi live DOM, console error, dan performa browser", docs: "https://github.com/ChromeDevTools/chrome-devtools-mcp", env: "CHROME_DEVTOOLS_MCP_URL" },
};

export function isMcpProvider(value: unknown): value is McpProvider {
  return typeof value === "string" && (MCP_PROVIDERS as readonly string[]).includes(value);
}

function getDynamicCredential(provider: McpProvider): { token?: string; customUrl?: string } {
  try {
    const credPath = path.join(process.cwd(), ".data", "mcp_credentials.json");
    if (fsSync.existsSync(credPath)) {
      const parsed = JSON.parse(fsSync.readFileSync(credPath, "utf-8"));
      return {
        token: parsed.tokens?.[provider],
        customUrl: parsed.customUrls?.[provider],
      };
    }
  } catch {}
  return {};
}

function endpoint(provider: McpProvider): { url: URL; headers: HeadersInit } | null {
  const cred = getDynamicCredential(provider);

  if (provider === "perplexity") {
    const token = cred.token || process.env.PERPLEXITY_API_KEY;
    return token ? { url: new URL("https://api.perplexity.ai/mcp"), headers: { Authorization: `Bearer ${token}` } } : null;
  }
  if (provider === "firecrawl") {
    const token = cred.token || process.env.FIRECRAWL_API_KEY;
    return { url: new URL("https://mcp.firecrawl.dev/v2/mcp"), headers: token ? { Authorization: `Bearer ${token}` } : {} };
  }
  if (provider === "posthog") {
    const token = cred.token || process.env.POSTHOG_MCP_ACCESS_TOKEN;
    return token ? { url: new URL("https://mcp.posthog.com/mcp"), headers: { Authorization: `Bearer ${token}` } } : null;
  }
  if (provider === "composio") {
    const token = cred.token || process.env.COMPOSIO_CONSUMER_API_KEY;
    return token ? { url: new URL("https://connect.composio.dev/mcp"), headers: { "x-consumer-api-key": token } } : null;
  }
  if (provider === "supabase") {
    const token = cred.token || process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const urlStr = cred.customUrl || process.env.SUPABASE_MCP_URL || (process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.replace(/\/$/, "")}/mcp` : "https://mcp.supabase.com/mcp");
    return token ? { url: new URL(urlStr), headers: { Authorization: `Bearer ${token}` } } : null;
  }
  if (provider === "vercel") {
    const token = cred.token || process.env.VERCEL_TOKEN;
    const urlStr = cred.customUrl || process.env.VERCEL_MCP_URL || "https://mcp.vercel.com";
    return token ? { url: new URL(urlStr), headers: { Authorization: `Bearer ${token}` } } : null;
  }
  if (provider === "chrome-devtools") {
    const url = new URL(cred.customUrl || process.env.CHROME_DEVTOOLS_MCP_URL || "http://127.0.0.1:9222/mcp");
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Chrome DevTools MCP harus berjalan di komputer ini.");
    return { url, headers: {} };
  }
  const url = new URL(cred.customUrl || process.env.PLAYWRIGHT_MCP_URL || "http://127.0.0.1:8931/mcp");
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Playwright MCP harus berjalan di komputer ini.");
  return { url, headers: {} };
}

export function mcpProviderStatus() {
  return MCP_PROVIDERS.map((id) => {
    const isLocal = id === "chrome-devtools" || id === "playwright";
    const cred = getDynamicCredential(id);
    const hasToken = !!cred.token || !!process.env[MCP_CATALOG[id].env];
    const isSupabaseConfigured = id === "supabase" && (hasToken || !!(process.env.SUPABASE_URL || process.env.SUPABASE_ANON_KEY));
    const authLink = PROVIDER_AUTH_LINKS[id];

    return {
      id,
      ...MCP_CATALOG[id],
      isLocal,
      hasSavedToken: !!cred.token,
      authLink: authLink?.url,
      authLabel: authLink?.label,
      configured: id === "firecrawl" || (isLocal ? !!cred.customUrl || !!process.env[MCP_CATALOG[id].env] : hasToken || isSupabaseConfigured),
    };
  });
}

export function mcpRequiresStudioSession(provider: McpProvider): boolean {
  return provider !== "firecrawl" || !!process.env.FIRECRAWL_API_KEY;
}

async function withClient<T>(provider: McpProvider, work: (client: Client) => Promise<T>): Promise<T> {
  const target = endpoint(provider);
  if (!target) throw new Error(`${MCP_CATALOG[provider].name} perlu kredensial server (${MCP_CATALOG[provider].env}).`);
  const client = new Client({ name: "vox-ai", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(target.url, { requestInit: { headers: target.headers } });
  try {
    await client.connect(transport);
    return await work(client);
  } finally {
    await client.close().catch(() => {});
  }
}

export type McpToolInfo = { name: string; description: string; inputSchema: Record<string, unknown>; readOnly: boolean };

export function isReadTool(provider: McpProvider, tool: { name: string; annotations?: { readOnlyHint?: boolean } }): boolean {
  if (tool.annotations?.readOnlyHint === true) return true;
  if (tool.annotations?.readOnlyHint === false) return false;
  const name = tool.name.toLowerCase();
  if (provider === "playwright") return /^(?:browser_navigate|browser_snapshot|browser_take_screenshot|browser_tab_list)$/.test(name);
  if (provider === "firecrawl") return /(?:search|scrape|parse|map|extract|read|get)/.test(name) && !/(?:delete|update|create|write|batch)/.test(name);
  if (provider === "perplexity") return /(?:search|ask|research|reason)/.test(name);
  if (provider === "supabase") return /(?:list|get|read|describe|inspect|schema|fetch|select|explain)/.test(name) && !/(?:delete|drop|update|insert|truncate|alter)/.test(name);
  if (provider === "vercel") return /(?:list|get|read|inspect|describe|log|status|check)/.test(name) && !/(?:delete|remove|destroy|cancel|create_deploy)/.test(name);
  if (provider === "chrome-devtools") return /(?:navigate|snapshot|screenshot|evaluate|inspect|console|network|performance|get|list|dom)/.test(name) && !/(?:click|type|fill|submit|press)/.test(name);
  return /(?:^|_)(?:search|list|get|read|query|describe|inspect|discover|overview)(?:_|$)/.test(name) && !/(?:delete|update|create|write|execute|send|post)/.test(name);
}

export async function listMcpTools(provider: McpProvider): Promise<McpToolInfo[]> {
  return withClient(provider, async (client) => {
    const response = await client.listTools(undefined, { timeout: 15_000 });
    return response.tools.slice(0, 80).map((tool) => ({ name: tool.name, description: (tool.description || "").slice(0, 300), inputSchema: tool.inputSchema as Record<string, unknown>, readOnly: isReadTool(provider, tool) }));
  });
}

export async function callMcpReadTool(provider: McpProvider, name: string, args: Record<string, unknown>): Promise<string> {
  return withClient(provider, async (client) => {
    const tools = (await client.listTools(undefined, { timeout: 15_000 })).tools;
    const selected = tools.find((tool) => tool.name === name);
    if (!selected || !isReadTool(provider, selected)) throw new Error("Alat MCP itu tidak tersedia untuk mode baca.");
    return textFromResult(await client.callTool({ name, arguments: args }, undefined, { timeout: 45_000 }) as unknown);
  });
}

function textFromResult(result: unknown): string {
  const value = result && typeof result === "object" ? result as { isError?: boolean; content?: unknown; toolResult?: unknown } : {};
  if (value.isError) throw new Error("Layanan MCP melaporkan kegagalan.");
  if (value.toolResult !== undefined) return JSON.stringify(value.toolResult).slice(0, 10_000);
  const content: unknown[] = Array.isArray(value.content) ? value.content : [];
  return content.filter((part): part is { type: "text"; text: string } => !!part && typeof part === "object" && (part as { type?: unknown }).type === "text" && typeof (part as { text?: unknown }).text === "string")
    .map((part) => part.text).join("\n").slice(0, 10_000) || "Alat MCP tidak mengembalikan teks.";
}

export async function runMcpReadTask(provider: McpProvider, choose: (tools: McpToolInfo[]) => Promise<{ name: string; arguments: Record<string, unknown> }>): Promise<{ tool: string; text: string }> {
  return withClient(provider, async (client) => {
    const available = (await client.listTools(undefined, { timeout: 15_000 })).tools.filter((tool) => isReadTool(provider, tool));
    if (!available.length) throw new Error("Layanan ini belum menyediakan alat baca yang aman untuk VOX.");
    const selected = await choose(available.map((tool) => ({ name: tool.name, description: (tool.description || "").slice(0, 300), inputSchema: tool.inputSchema as Record<string, unknown>, readOnly: true })));
    if (!available.some((tool) => tool.name === selected.name)) throw new Error("Alat MCP yang dipilih tidak tersedia.");
    const text = textFromResult(await client.callTool({ name: selected.name, arguments: selected.arguments }, undefined, { timeout: 45_000 }) as unknown);
    return { tool: selected.name, text };
  });
}
