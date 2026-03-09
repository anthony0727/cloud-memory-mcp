import type { StorageAdapter } from "../../storage/base.js";
import type { Memory } from "../formatter.js";
import { parseMemories } from "../formatter.js";
import type { MemoryArchitecture } from "./base.js";

function formatFlat(memories: Memory[]): string {
  const sorted = [...memories].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return sorted.map((m) => `- [${m.created_at}] [${m.id}] ${m.content}`).join("\n") + "\n";
}

export class FlatArchitecture implements MemoryArchitecture {
  name = "flat";

  async load(storage: StorageAdapter): Promise<Memory[]> {
    const raw = await storage.read("memories.md");
    return raw ? parseMemories(raw) : [];
  }

  async save(storage: StorageAdapter, memories: Memory[]): Promise<void> {
    await storage.write("memories.md", formatFlat(memories));
  }

  async loadRaw(storage: StorageAdapter): Promise<string> {
    return (await storage.read("memories.md")) ?? "No memories stored yet.";
  }
}
