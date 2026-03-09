import type { StorageAdapter } from "../../storage/base.js";
import type { Memory } from "../formatter.js";
import { parseMemories, formatMemories } from "../formatter.js";
import type { MemoryArchitecture } from "./base.js";

export class TemporalArchitecture implements MemoryArchitecture {
  name = "temporal";

  private monthKey(date: string): string {
    return date.slice(0, 7) + ".md"; // "2026-03.md"
  }

  async load(storage: StorageAdapter): Promise<Memory[]> {
    const files = await storage.list("");
    const mdFiles = files.filter((f) => /^\d{4}-\d{2}\.md$/.test(f)).sort();
    const all: Memory[] = [];
    for (const file of mdFiles) {
      const raw = await storage.read(file);
      if (raw) all.push(...parseMemories(raw));
    }
    return all;
  }

  async save(storage: StorageAdapter, memories: Memory[]): Promise<void> {
    // group by month
    const grouped = new Map<string, Memory[]>();
    for (const m of memories) {
      const key = this.monthKey(m.created_at);
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
    const mdFiles = files.filter((f) => /^\d{4}-\d{2}\.md$/.test(f)).sort().reverse();
    // load last 3 months
    const parts: string[] = [];
    for (const file of mdFiles.slice(0, 3)) {
      const raw = await storage.read(file);
      if (raw) parts.push(`# ${file}\n${raw}`);
    }
    return parts.length > 0 ? parts.join("\n\n") : "No memories stored yet.";
  }
}
