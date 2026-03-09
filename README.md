# cloud-memory-mcp

Agent-agnostic persistent memory for AI assistants. Your memories live in **your own** Google Drive as plain Markdown files.

Any AI that supports MCP can connect — Claude, GPT, Gemini, whatever comes next. **Your AI changes, your memory stays.**

## Install

```bash
npx cloud-memory-mcp --install
```

Registers the MCP server, opens browser for Google login → grant Drive access → done. Restart your AI client.

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

Default is flat — a single `memories.md` with category headers:

```markdown
# memories.md

## work
- [2026-01-01] [a1b2c3d4e5f6] Works at Acme Corp as Software Engineer

## preferences
- [2026-01-01] [e5f6a7b8c9d0] Prefers concise responses
```

### Custom Architectures

Set `CLOUD_MEMORY_ARCH` env var:

- **`flat`** (default) — Single file, category headers
- **`temporal`** — Monthly files (`2026-03.md`, `2026-04.md`)
- **`categorical`** — Separate files per category (`work.md`, `preferences.md`)
- **`hierarchical`** — Profile + episodic + semantic layers, inspired by [human memory research](https://www.nature.com/articles/s41562-025-02324-0)

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

- iCloud storage adapter
- Import from existing sources (CLAUDE.md, ChatGPT export)

## Inspiration

Inspired by [mem0](https://github.com/mem0ai/mem0) — the memory layer for AI agents. We adapted their insight that LLMs can manage their own memory lifecycle, but simplified the storage from vector DB to plain Markdown on user-owned cloud storage.

## License

MIT
