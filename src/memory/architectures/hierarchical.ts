import type { StorageAdapter } from "../../storage/base.js";
import type { Memory } from "../formatter.js";
import { parseMemories, formatMemories } from "../formatter.js";
import type { MemoryArchitecture } from "./base.js";

/**
 * Hierarchical architecture inspired by human memory systems:
 * - profile.md    → semantic/identity (who the user is, stable facts)
 * - episodic.md   → episodic memory (events, conversations, experiences)
 * - preferences.md → procedural (how user likes things done)
 * - context.md    → working memory (current projects, active threads)
 *
 * Reference: https://www.nature.com/articles/s41562-025-02324-0
 */

const LAYERS: Record<string, string[]> = {
  "profile.md": ["personal", "work", "health"],
  "episodic.md": ["general", "finance"],
  "preferences.md": ["preferences"],
  "context.md": ["context"],
};

function layerForCategory(category: string): string {
  for (const [file, cats] of Object.entries(LAYERS)) {
    if (cats.includes(category)) return file;
  }
  return "episodic.md"; // default
}

export class HierarchicalArchitecture implements MemoryArchitecture {
  name = "hierarchical";

  async load(storage: StorageAdapter): Promise<Memory[]> {
    const all: Memory[] = [];
    for (const file of Object.keys(LAYERS)) {
      const raw = await storage.read(file);
      if (raw) all.push(...parseMemories(raw));
    }
    return all;
  }

  async save(storage: StorageAdapter, memories: Memory[]): Promise<void> {
    const grouped = new Map<string, Memory[]>();
    for (const file of Object.keys(LAYERS)) grouped.set(file, []);

    for (const m of memories) {
      const file = layerForCategory(m.category);
      grouped.get(file)!.push(m);
    }

    for (const [file, mems] of grouped) {
      if (mems.length > 0) {
        await storage.write(file, formatMemories(mems));
      }
    }
  }

  async loadRaw(storage: StorageAdapter): Promise<string> {
    const parts: string[] = [];
    for (const file of Object.keys(LAYERS)) {
      const raw = await storage.read(file);
      if (raw) parts.push(`# ${file.replace(".md", "")}\n${raw}`);
    }
    return parts.length > 0 ? parts.join("\n\n") : "No memories stored yet.";
  }
}
