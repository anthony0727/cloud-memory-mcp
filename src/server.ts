#!/usr/bin/env node

import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { LocalAdapter } from "./storage/local.js";
import { GDriveAdapter } from "./storage/gdrive.js";
import { GitHubAdapter } from "./storage/github.js";
import type { StorageAdapter } from "./storage/base.js";
import { createArchitecture } from "./memory/architectures/index.js";
import { addMemory, searchMemories, getAllMemories, updateMemory, deleteMemory } from "./tools.js";

function hasGoogleCredentials(): boolean {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) return true;
  const bundled = join(__dirname, "..", "credentials.json");
  if (existsSync(bundled)) return true;
  const userFile = join(homedir(), ".cloud-memory-credentials.json");
  if (existsSync(userFile)) return true;
  // auth proxy mode — always available as fallback
  return true;
}

function createStorage(): { storage: StorageAdapter; name: string } {
  const backend = process.env.CLOUD_MEMORY_BACKEND ?? "gdrive";
  const knownBackends = ["local", "github", "gdrive"];
  if (process.env.CLOUD_MEMORY_BACKEND && !knownBackends.includes(backend)) {
    console.error(`Warning: unknown CLOUD_MEMORY_BACKEND "${backend}", falling back to gdrive`);
  }
  switch (backend) {
    case "local":
      return { storage: new LocalAdapter(), name: "local" };
    case "github":
      return { storage: new GitHubAdapter(), name: "github" };
    case "gdrive":
    default:
      if (!hasGoogleCredentials()) {
        console.error("No Google credentials found. Falling back to local storage.");
        console.error("For Google Drive: set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET or add credentials.json to project root.");
        return { storage: new LocalAdapter(), name: "local (fallback)" };
      }
      return { storage: new GDriveAdapter(), name: "gdrive" };
  }
}

const { storage, name: storageName } = createStorage();
const arch = createArchitecture();

const server = new Server(
  { name: "cloud-memory-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "add_memory",
      description:
        "Store new information to the user's persistent cloud memory. Use this INSTEAD of writing to local memory files. Extract discrete facts from the conversation and call this tool for each one. Deduplicate: check existing memories first (get_all_memories) before adding.",
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "The information to remember (natural language)" },
          category: {
            type: "string",
            description: "Optional category (work, finance, preferences, health, personal, general, context)",
          },
        },
        required: ["content"],
      },
    },
    {
      name: "search_memories",
      description: "Search stored memories by keyword query. Returns matching memories ranked by relevance.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (keywords)" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_all_memories",
      description: "Retrieve all user memories from cloud storage. Call this at conversation start to load user context. This replaces any local auto-memory system — cloud memory is the single source of truth.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "update_memory",
      description: "Directly update a specific memory by its ID.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Memory ID (8-char hex)" },
          content: { type: "string", description: "New content for this memory" },
        },
        required: ["id", "content"],
      },
    },
    {
      name: "delete_memory",
      description: "Delete a specific memory by its ID.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Memory ID (8-char hex)" },
        },
        required: ["id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "add_memory": {
        const { content, category } = z
          .object({ content: z.string(), category: z.string().optional() })
          .parse(args);
        const result = await addMemory(storage, arch, content, category);
        return { content: [{ type: "text", text: result }] };
      }

      case "search_memories": {
        const { query } = z.object({ query: z.string() }).parse(args);
        const result = await searchMemories(storage, arch, query);
        return { content: [{ type: "text", text: result }] };
      }

      case "get_all_memories": {
        const result = await getAllMemories(storage, arch);
        return { content: [{ type: "text", text: result }] };
      }

      case "update_memory": {
        const { id, content } = z.object({ id: z.string(), content: z.string() }).parse(args);
        const result = await updateMemory(storage, arch, id, content);
        return { content: [{ type: "text", text: result }] };
      }

      case "delete_memory": {
        const { id } = z.object({ id: z.string() }).parse(args);
        const result = await deleteMemory(storage, arch, id);
        return { content: [{ type: "text", text: result }] };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid params: ${error.errors.map((e) => e.message).join(", ")}`);
    }
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, error instanceof Error ? error.message : "Unknown error");
  }
});

// --uninstall mode: clean up local tokens and config
if (process.argv.includes("--uninstall")) {
  (async () => {
    const { rm } = await import("node:fs/promises");
    const tokenPath = join(homedir(), ".cloud-memory", "gdrive-token.json");
    const credPath = join(homedir(), ".cloud-memory-credentials.json");
    let cleaned = false;
    for (const p of [tokenPath, credPath]) {
      if (existsSync(p)) {
        await rm(p);
        console.error(`Removed ${p}`);
        cleaned = true;
      }
    }
    // remove MCP from claude config
    try {
      const { execSync } = await import("node:child_process");
      execSync("claude mcp remove cloud-memory -s user", { stdio: "inherit" });
      console.error("Removed cloud-memory from Claude MCP config.");
      cleaned = true;
    } catch {}
    console.error(cleaned ? "Uninstall complete." : "Nothing to clean up.");
    console.error("Your memories in Google Drive are untouched — delete the 'Cloud Memory' folder manually if desired.");
    process.exit(0);
  })();
} else
// --install mode: register MCP + trigger OAuth and exit
if (process.argv.includes("--install")) {
  (async () => {
    // register MCP in claude config
    try {
      const { execSync } = await import("node:child_process");
      execSync("claude mcp add cloud-memory -s user -- npx -y cloud-memory-mcp", { stdio: "inherit" });
      console.error("Registered cloud-memory MCP.");
    } catch {
      console.error("Could not auto-register MCP (claude CLI not found). Add manually:");
      console.error("  claude mcp add cloud-memory -s user -- npx -y cloud-memory-mcp");
    }
    // trigger OAuth
    console.error("Authenticating with Google Drive...");
    try {
      await storage.read("memories.md");
      console.error("Install complete! Google Drive connected. Restart your AI client.");
      process.exit(0);
    } catch (e) {
      console.error("Setup failed:", e instanceof Error ? e.message : e);
      process.exit(1);
    }
  })();
} else {
  const transport = new StdioServerTransport();
  server.connect(transport).then(async () => {
    console.error(`cloud-memory-mcp running (storage=${storageName}, arch=${arch.name})`);
    // eagerly authenticate on startup so OAuth popup opens immediately
    if (storageName === "gdrive") {
      try {
        await storage.read("memories.md");
        console.error("Google Drive connected.");
      } catch (e) {
        console.error("Google Drive auth failed:", e instanceof Error ? e.message : e);
      }
    }
  }).catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  });
}
