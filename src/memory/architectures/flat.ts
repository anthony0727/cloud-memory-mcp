import type { StorageAdapter } from "../../storage/base.js";
import type { Memory } from "../formatter.js";
import type { MemoryArchitecture } from "./base.js";

const BLOCK_FILES = new Set(["profile.md", "preferences.md", "context.md"]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function filename(m: Memory): string {
  return `${m.created_at}_${m.id}_${slugify(m.content)}.md`;
}

function parseFilename(name: string): { created_at: string; id: string } | null {
  const match = name.match(/^(\d{4}-\d{2}-\d{2})_([a-f0-9]{8,12})_/);
  return match ? { created_at: match[1], id: match[2] } : null;
}

export class FlatArchitecture implements MemoryArchitecture {
  name = "flat";

  async load(storage: StorageAdapter): Promise<Memory[]> {
    const files = await storage.list("");
    const mdFiles = files.filter((f) => f.endsWith(".md") && !BLOCK_FILES.has(f)).sort();
    const memories: Memory[] = [];
    for (const file of mdFiles) {
      const meta = parseFilename(file);
      if (!meta) continue;
      const content = await storage.read(file);
      if (content?.trim()) {
        memories.push({
          id: meta.id,
          content: content.trim(),
          category: "general",
          created_at: meta.created_at,
        });
      }
    }
    return memories;
  }

  async save(storage: StorageAdapter, memories: Memory[]): Promise<void> {
    const existingFiles = (await storage.list("")).filter((f) => f.endsWith(".md") && !BLOCK_FILES.has(f));
    const existingById = new Map<string, string>();
    for (const f of existingFiles) {
      const meta = parseFilename(f);
      if (meta) existingById.set(meta.id, f);
    }

    const activeIds = new Set<string>();
    for (const m of memories) {
      activeIds.add(m.id);
      const fname = filename(m);
      const existing = existingById.get(m.id);
      if (existing && existing !== fname) {
        // content changed — delete old, write new
        await storage.delete(existing);
        await storage.write(fname, m.content);
      } else if (!existing) {
        await storage.write(fname, m.content);
      }
    }

    // delete removed memories
    for (const [id, file] of existingById) {
      if (!activeIds.has(id)) {
        await storage.delete(file);
      }
    }
  }

  async loadRaw(storage: StorageAdapter): Promise<string> {
    const memories = await this.load(storage);
    if (memories.length === 0) return "No memories stored yet.";
    return memories
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((m) => `- [${m.created_at}] [${m.id}] ${m.content}`)
      .join("\n");
  }

  async loadRecent(storage: StorageAdapter, limit: number): Promise<string> {
    const memories = await this.load(storage);
    if (memories.length === 0) return "No memories stored yet.";
    const recent = memories
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
    return recent
      .map((m) => `- [${m.created_at}] [${m.id}] ${m.content}`)
      .join("\n");
  }
}
