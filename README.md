# cloud-memory-mcp

Agent-agnostic persistent memory for AI assistants. Your memories live in **your own** Google Drive as plain Markdown files.

Any AI that supports MCP can connect — Claude, GPT, Gemini, whatever comes next. **Your AI changes, your memory stays.**

## Install

**Step 1: Authenticate with Google Drive (one-time)**

```bash
npx cloud-memory-mcp@latest --install
```

Opens browser → Google login → grant Drive access → done.

**Step 2: Register in your AI client**

```bash
# Claude Code
claude mcp add cloud-memory -s user -- npx -y cloud-memory-mcp

# Gemini CLI
gemini mcp add -s user cloud-memory npx -y cloud-memory-mcp

# Any MCP client: use stdio transport with command "npx -y cloud-memory-mcp"
```

Restart your AI client. Memory tools are live.

## Uninstall

```bash
npx cloud-memory-mcp --uninstall
```

Removes local tokens and MCP config. Your memories in Google Drive are untouched.

## Why This Exists

**Agent-agnostic** — Works with Claude, GPT, Gemini, or whatever AI comes next. Switch providers anytime, your memory follows.

**Secure by default** — Memories stored in YOUR Google Drive. Google's infrastructure, your account, your encryption. No third-party servers touching your data.

**Permanent** — Cloud storage persists across machines, OS reinstalls, and time. Not tied to any local filesystem or app.

**Human-readable** — Plain Markdown files you can open, edit, or delete anytime in Google Drive.

**Virtually unlimited** — Text-based memories take almost zero storage. Even thousands of memories barely scratch Google Drive's 15GB free tier.

| Existing Products | Problem |
|-------------------|---------|
| OpenAI Memory | ChatGPT-locked |
| Claude Memory | Anthropic-locked |
| mem0 | Their server, their rules |
| **cloud-memory-mcp** | **Your data. Any AI. Forever.** |

## Natural Account Separation

Use different Google accounts to naturally separate contexts:

- **Personal Gmail** → personal memories, preferences, life stuff
- **Work Google account** → work projects, meeting notes, professional context

Each account gets its own "Cloud Memory" folder. No config needed — just log in with the right account.

## Storage Backends

Default is Google Drive. Override with `CLOUD_MEMORY_BACKEND` env var:

| Backend | Value | Storage Location |
|---------|-------|-----------------|
| Google Drive | `gdrive` (default) | `Cloud Memory/` folder in your Drive |
| GitHub | `github` | Private repo `my-ai-memory` |
| Local | `local` | `~/.cloud-memory/memories.md` |

### Google Drive

Works out of the box. First run opens browser for Google login. Token saved locally, auto-refreshes.

### GitHub

Set `GITHUB_TOKEN` and `CLOUD_MEMORY_BACKEND=github`. Auto-creates a private repo `my-ai-memory`.

## Memory Structure

Each memory is an individual file in your Google Drive:

```
Cloud Memory/
  profile.md                                        ← stable identity info
  2026-01-15_a1b2c3d4e5f6_works-at-acme-corp.md    ← individual memory
  2026-02-03_e5f6a7b8c9d0_prefers-dark-mode.md
  2026-03-09_c9d0e1f2a3b4_started-learning-rust.md
```

Browse, edit, or delete memories directly in Google Drive. `profile.md` holds stable facts (name, job, preferences) — the AI updates it as it learns about you.

## MCP Tools

| Tool | Description |
|------|-------------|
| `add_memory` | Store a memory. Deduplicates automatically. |
| `search_memories` | Keyword search across all memories (uses Google Drive fullText search). |
| `get_recent_memories` | Load the most recent memories (default 128). |
| `read_block` | Read a memory block (`profile`, `preferences`, `context`). |
| `write_block` | Update a memory block. |
| `update_memory` | Edit a memory by ID. |
| `delete_memory` | Remove a memory by ID. |

The AI client (Claude, GPT, etc.) decides what to remember. The MCP server just stores and retrieves — no LLM calls, no API keys, no extra cost.

## Activating Memory (Recommended)

The MCP tools are available, but your AI won't use them unless instructed. Add a line to your agent's system prompt or instruction file:

Add the following to your agent's instruction file (`CLAUDE.md`, `GEMINI.md`, etc.):

```
- Use cloud-memory MCP tools for all memory. At conversation start: read_block("profile") + get_recent_memories. Store facts with add_memory, update blocks with write_block.
```

Running `npx cloud-memory-mcp@latest --install` will prompt to do this automatically for Claude Code (disables local auto-memory in `~/.claude/settings.json` + adds the instruction to `~/.claude/CLAUDE.md`).

## How It Works

1. AI reads `profile` block + recent memories at conversation start
2. During conversation, AI stores new facts via `add_memory` or updates blocks
3. Each memory becomes an individual file in your Google Drive
4. Next conversation — same context, any AI client, any machine

No vector DB. No embedding models. No infra. Just Markdown files in cloud storage you already own.

## Roadmap

- Local cache layer for faster reads
- iCloud storage adapter
- Import from existing sources (CLAUDE.md, ChatGPT export)

## Inspiration

Inspired by [mem0](https://github.com/mem0ai/mem0) — the memory layer for AI agents. We adapted their insight that LLMs can manage their own memory lifecycle, but simplified the storage from vector DB to plain Markdown on user-owned cloud storage.

## License

MIT
