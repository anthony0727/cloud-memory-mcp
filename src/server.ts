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
import { addMemory, searchMemories, getRecentMemories, readBlock, writeBlock, updateMemory, deleteMemory } from "./tools.js";

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
        "Store a new memory to the user's persistent cloud storage. Each memory becomes an individual file in Google Drive. Deduplicates automatically.",
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "The information to remember (natural language)" },
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
      name: "get_recent_memories",
      description: "Retrieve the most recent memories. Call this at conversation start to load user context.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max number of memories to return (default 128)" },
        },
      },
    },
    {
      name: "read_block",
      description: "Read a memory block. Blocks: 'profile' (who the user is — name, job, background), 'preferences' (how the user works — coding style, tools, habits), 'context' (what the user is doing now — active projects, current threads). Load profile and context at conversation start.",
      inputSchema: {
        type: "object",
        properties: {
          block: { type: "string", enum: ["profile", "preferences", "context"], description: "Which block to read" },
        },
        required: ["block"],
      },
    },
    {
      name: "write_block",
      description: "Update a memory block. Overwrite the full block content. Blocks: 'profile' (stable identity — update when learning who the user is), 'preferences' (procedural — update when learning how user likes things done), 'context' (working memory — update when projects/tasks change).",
      inputSchema: {
        type: "object",
        properties: {
          block: { type: "string", enum: ["profile", "preferences", "context"], description: "Which block to update" },
          content: { type: "string", description: "Full block content (markdown)" },
        },
        required: ["block", "content"],
      },
    },
    {
      name: "update_memory",
      description: "Update a specific memory by its ID.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Memory ID (hex)" },
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
          id: { type: "string", description: "Memory ID (hex)" },
        },
        required: ["id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const tag = `[${storageName}]`;
  try {
    switch (name) {
      case "add_memory": {
        const { content } = z.object({ content: z.string() }).parse(args);
        const result = await addMemory(storage, arch, content);
        return { content: [{ type: "text", text: `${tag} ${result}` }] };
      }

      case "search_memories": {
        const { query } = z.object({ query: z.string() }).parse(args);
        const result = await searchMemories(storage, arch, query);
        return { content: [{ type: "text", text: `${tag} ${result}` }] };
      }

      case "get_recent_memories": {
        const { limit } = z.object({ limit: z.number().optional() }).parse(args);
        const result = await getRecentMemories(storage, arch, limit ?? 128);
        return { content: [{ type: "text", text: `${tag} ${result}` }] };
      }

      case "read_block": {
        const { block } = z.object({ block: z.string() }).parse(args);
        const result = await readBlock(storage, block);
        return { content: [{ type: "text", text: `${tag} ${result}` }] };
      }

      case "write_block": {
        const { block, content } = z.object({ block: z.string(), content: z.string() }).parse(args);
        const result = await writeBlock(storage, block, content);
        return { content: [{ type: "text", text: `${tag} ${result}` }] };
      }

      case "update_memory": {
        const { id, content } = z.object({ id: z.string(), content: z.string() }).parse(args);
        const result = await updateMemory(storage, arch, id, content);
        return { content: [{ type: "text", text: `${tag} ${result}` }] };
      }

      case "delete_memory": {
        const { id } = z.object({ id: z.string() }).parse(args);
        const result = await deleteMemory(storage, arch, id);
        return { content: [{ type: "text", text: `${tag} ${result}` }] };
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
    // MCP registration removal is manual — each AI client has different commands
    console.error("Remove the MCP registration from your AI client manually if needed.");
    console.error(cleaned ? "Uninstall complete." : "Nothing to clean up.");
    console.error("Your memories in Google Drive are untouched — delete the 'Cloud Memory' folder manually if desired.");
    process.exit(0);
  })();
} else
// --install mode: register MCP + trigger OAuth and exit
if (process.argv.includes("--install")) {
  (async () => {
    const { createInterface } = await import("node:readline");
    const { readFile: rf, writeFile: wf, mkdir: mk } = await import("node:fs/promises");

    // trigger OAuth
    console.error("Authenticating with Google Drive...");
    try {
      await storage.read("__ping__");
      console.error("Google Drive connected.");
    } catch (e) {
      console.error("Setup failed:", e instanceof Error ? e.message : e);
      process.exit(1);
    }

    // ask about Claude Code memory override
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    const ask = (q: string): Promise<string> => new Promise((r) => rl.question(q, r));

    const answer = await ask("\nReplace Claude Code's local memory with cloud-memory? (Y/n) ");
    if (answer.trim().toLowerCase() !== "n") {
      // disable auto memory in settings.json
      const settingsPath = join(homedir(), ".claude", "settings.json");
      try {
        const settings = JSON.parse(await rf(settingsPath, "utf-8").catch(() => "{}"));
        settings.autoMemoryEnabled = false;
        await mk(join(homedir(), ".claude"), { recursive: true });
        await wf(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
        console.error("Disabled Claude Code local auto-memory.");
      } catch {}

      // add cloud-memory instructions to CLAUDE.md
      const claudeMdPath = join(homedir(), ".claude", "CLAUDE.md");
      const existing = await rf(claudeMdPath, "utf-8").catch(() => "");
      if (!existing.includes("cloud-memory")) {
        const instruction = `\n- Use cloud-memory MCP tools for all memory. At conversation start: read_block("profile") + get_recent_memories. Store facts with add_memory, update blocks with write_block.\n`;
        await wf(claudeMdPath, existing + instruction, "utf-8");
        console.error("Added cloud-memory instruction to ~/.claude/CLAUDE.md");
      }
    }

    rl.close();
    console.error("\nInstall complete! Restart your AI client.");
    process.exit(0);
  })();
} else {
  const transport = new StdioServerTransport();
  server.connect(transport).then(async () => {
    console.error(`cloud-memory-mcp running (storage=${storageName}, arch=${arch.name})`);
    // eagerly authenticate on startup so OAuth popup opens immediately
    if (storageName === "gdrive") {
      try {
        await storage.list("");
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
