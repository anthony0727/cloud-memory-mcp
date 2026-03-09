import type { StorageAdapter } from "../../storage/base.js";
import type { Memory } from "../formatter.js";
import { parseMemories, formatMemories } from "../formatter.js";
import type { MemoryArchitecture } from "./base.js";

export class FlatArchitecture implements MemoryArchitecture {
  name = "flat";

  async load(storage: StorageAdapter): Promise<Memory[]> {
    const raw = await storage.read("memories.md");
    return raw ? parseMemories(raw) : [];
  }

  async save(storage: StorageAdapter, memories: Memory[]): Promise<void> {
    await storage.write("memories.md", formatMemories(memories));
  }

  async loadRaw(storage: StorageAdapter): Promise<string> {
    return (await storage.read("memories.md")) ?? "No memories stored yet.";
  }
}
