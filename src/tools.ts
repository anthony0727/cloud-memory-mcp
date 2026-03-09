import type { StorageAdapter } from "./storage/base.js";
import type { MemoryArchitecture } from "./memory/architectures/base.js";
import { newId, today, type Memory } from "./memory/formatter.js";

let lock = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const p = lock.then(fn);
  lock = p.then(() => {}, () => {});
  return p;
}

const BLOCKS: Record<string, string> = {
  profile: "profile.md",
  preferences: "preferences.md",
  context: "context.md",
};

export async function addMemory(
  storage: StorageAdapter,
  arch: MemoryArchitecture,
  content: string,
): Promise<string> {
  return withLock(async () => {
    const existing = await arch.load(storage);

    // simple dedup: skip if exact content already exists
    const dupe = existing.find((m) => m.content === content);
    if (dupe) return `Already stored: [${dupe.id}] ${dupe.content}`;

    const memory: Memory = {
      id: newId(),
      content,
      category: "general",
      created_at: today(),
    };

    existing.push(memory);
    await arch.save(storage, existing);
    return `ADD: [${memory.id}] ${memory.content}`;
  });
}

export async function searchMemories(
  storage: StorageAdapter,
  arch: MemoryArchitecture,
  query: string
): Promise<string> {
  const memories = await arch.load(storage);
  if (memories.length === 0) return "No memories stored yet.";

  const terms = query.toLowerCase().split(/\s+/);
  const scored = memories.map((m) => {
    const text = m.content.toLowerCase();
    const score = terms.filter((t) => text.includes(t)).length;
    return { ...m, score };
  });

  const results = scored.filter((m) => m.score > 0).sort((a, b) => b.score - a.score);
  if (results.length === 0) return `No memories matching "${query}".`;

  return results.map((m) => `[${m.id}] [${m.created_at}] ${m.content}`).join("\n");
}

export async function getRecentMemories(
  storage: StorageAdapter,
  arch: MemoryArchitecture,
  limit: number = 128
): Promise<string> {
  return arch.loadRecent(storage, limit);
}

export async function readBlock(
  storage: StorageAdapter,
  block: string,
): Promise<string> {
  const file = BLOCKS[block];
  if (!file) return `Unknown block: ${block}. Valid: ${Object.keys(BLOCKS).join(", ")}`;
  return (await storage.read(file)) ?? `No ${block} yet.`;
}

export async function writeBlock(
  storage: StorageAdapter,
  block: string,
  content: string,
): Promise<string> {
  const file = BLOCKS[block];
  if (!file) return `Unknown block: ${block}. Valid: ${Object.keys(BLOCKS).join(", ")}`;
  await storage.write(file, content);
  return `${block} updated.`;
}

export async function updateMemory(
  storage: StorageAdapter,
  arch: MemoryArchitecture,
  id: string,
  content: string
): Promise<string> {
  return withLock(async () => {
    const memories = await arch.load(storage);
    const idx = memories.findIndex((m) => m.id === id);
    if (idx === -1) return `Memory ${id} not found.`;

    memories[idx] = { ...memories[idx], content };
    await arch.save(storage, memories);
    return `Updated memory ${id}.`;
  });
}

export async function deleteMemory(
  storage: StorageAdapter,
  arch: MemoryArchitecture,
  id: string
): Promise<string> {
  return withLock(async () => {
    const memories = await arch.load(storage);
    const idx = memories.findIndex((m) => m.id === id);
    if (idx === -1) return `Memory ${id} not found.`;

    const removed = memories.splice(idx, 1)[0];
    await arch.save(storage, memories);
    return `Deleted memory ${id}: ${removed.content}`;
  });
}
