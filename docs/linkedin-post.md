# LinkedIn Post Draft

---

**Your AI forgets you every session. I built the fix.**

I just open-sourced **cloud-memory-mcp** — persistent personal memory for AI assistants, stored in YOUR Google Drive.

One line to install. Works with Claude, GPT, Gemini, or whatever comes next.

Here's the problem:
- OpenAI Memory? Locked to ChatGPT.
- Claude Memory? Locked to Anthropic.
- mem0? Their servers, their rules.

What if your memory was truly YOURS?

**cloud-memory-mcp** stores your AI's memory as plain Markdown files in your own Google Drive (or GitHub, or local). Any AI agent that supports MCP can plug in.

Switch from Claude to GPT tomorrow? Your memory follows you.
Get a new laptop? Your memory is already in the cloud.
Worried about security? It's Google Drive — you own it, you control it.

The setup:
```
git clone https://github.com/jwseok0727/cloud-memory-mcp
npm install && npm run build
```
Add one config block. Done.

Under the hood, it uses mem0-inspired two-phase extraction — the AI automatically extracts facts from conversations, deduplicates against what it already knows, and decides whether to ADD, UPDATE, or skip. No vector DB. No infra. Just Markdown.

Memory architecture is customizable too — flat, temporal, categorical, or hierarchical (inspired by how human memory actually works: https://www.nature.com/articles/s41562-025-02324-0).

This is:
- Agent-agnostic (Claude, GPT, Gemini, anything with MCP)
- Machine-agnostic (cloud storage = access anywhere)
- Permanent (your Drive, your data, forever)
- Secure (Google/GitHub infrastructure, you own the keys)

The AI landscape changes fast. Your personal context shouldn't be locked into any single provider.

Inspired by the great work at @mem0ai. Built on MCP (Model Context Protocol).

GitHub: https://github.com/jwseok0727/cloud-memory-mcp

#AI #OpenSource #MCP #PersonalAI #AgentAgnostic

---
