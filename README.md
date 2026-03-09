# cloud-memory-mcp

Agent-agnostic persistent memory for AI assistants. Your memories live in **your own** Google Drive as plain Markdown files.

Any AI that supports MCP can connect — Claude, GPT, Gemini, whatever comes next. **Your AI changes, your memory stays.**

## Install

**Step 1: Authenticate with Google Drive (one-time)**

```bash
npx cloud-memory-mcp --install
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

## Memory Architecture

A single `memories.md` file, chronologically ordered:

```markdown
- [2026-01-15] [a1b2c3d4e5f6] Works at Acme Corp as Software Engineer
- [2026-02-03] [e5f6a7b8c9d0] Prefers concise responses
- [2026-03-09] [c9d0e1f2a3b4] Started learning Rust
```

The architecture layer is pluggable — future versions will support hierarchical memory structures inspired by [human memory research](https://www.nature.com/articles/s41562-025-02324-0).

## MCP Tools

| Tool | Description |
|------|-------------|
| `add_memory` | Store a fact. Deduplicates automatically. |
| `search_memories` | Keyword search across all memories. |
| `get_all_memories` | Load full memory context. |
| `update_memory` | Edit a memory by ID. |
| `delete_memory` | Remove a memory by ID. |

The AI client (Claude, GPT, etc.) decides what to remember. The MCP server just stores and retrieves — no LLM calls, no API keys, no extra cost.

## How It Works

1. AI extracts facts from your conversation
2. AI calls `add_memory` with each fact
3. MCP server deduplicates and stores as Markdown in your Google Drive
4. Next conversation, AI calls `get_all_memories` to reload your context

No vector DB. No embedding models. No infra. Just Markdown files in cloud storage you already own.

## Roadmap

- Hierarchical memory architecture (profile/episodic/preferences layers, inspired by [Nature paper](https://www.nature.com/articles/s41562-025-02324-0))
- Local cache layer for faster reads
- iCloud storage adapter
- Import from existing sources (CLAUDE.md, ChatGPT export)

## Inspiration

Inspired by [mem0](https://github.com/mem0ai/mem0) — the memory layer for AI agents. We adapted their insight that LLMs can manage their own memory lifecycle, but simplified the storage from vector DB to plain Markdown on user-owned cloud storage.

## License

MIT
