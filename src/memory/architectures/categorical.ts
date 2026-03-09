import type { StorageAdapter } from "../../storage/base.js";
import type { Memory } from "../formatter.js";
import { parseMemories, formatMemories } from "../formatter.js";
import type { MemoryArchitecture } from "./base.js";

export class CategoricalArchitecture implements MemoryArchitecture {
  name = "categorical";

  private catFile(category: string): string {
    return `${category}.md`;
  }

  async load(storage: StorageAdapter): Promise<Memory[]> {
    const files = await storage.list("");
    const mdFiles = files.filter((f) => f.endsWith(".md") && f !== "memory-arch.json");
    const all: Memory[] = [];
    for (const file of mdFiles) {
      const raw = await storage.read(file);
      if (raw) all.push(...parseMemories(raw));
    }
    return all;
  }

  async save(storage: StorageAdapter, memories: Memory[]): Promise<void> {
    const grouped = new Map<string, Memory[]>();
    for (const m of memories) {
      const key = this.catFile(m.category);
      const list = grouped.get(key) ?? [];
      list.push(m);
      grouped.set(key, list);
    }
    for (const [file, mems] of grouped) {
      await storage.write(file, formatMemories(mems));
    }
  }

  async loadRaw(storage: StorageAdapter): Promise<string> {
    const files = await storage.list("");
    const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
    const parts: string[] = [];
    for (const file of mdFiles) {
      const raw = await storage.read(file);
      if (raw) parts.push(raw);
    }
    return parts.length > 0 ? parts.join("\n") : "No memories stored yet.";
  }
}
