import type { StorageAdapter } from "./storage/base.js";
import type { MemoryArchitecture } from "./memory/architectures/base.js";
import { newId, today, type Memory } from "./memory/formatter.js";

let lock = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const p = lock.then(fn);
  lock = p.then(() => {}, () => {});
  return p;
}

const CATEGORY_RE = /[^a-zA-Z0-9_-]/g;
function sanitizeCategory(cat: string): string {
  return cat.replace(CATEGORY_RE, "_");
}

export async function addMemory(
  storage: StorageAdapter,
  arch: MemoryArchitecture,
  content: string,
  category?: string
): Promise<string> {
  return withLock(async () => {
    const existing = await arch.load(storage);

    // simple dedup: skip if exact content already exists
    const dupe = existing.find((m) => m.content === content);
    if (dupe) return `Already stored: [${dupe.id}] ${dupe.content}`;

    const memory: Memory = {
      id: newId(),
      content,
      category: sanitizeCategory(category ?? "general"),
      created_at: today(),
    };

    existing.push(memory);
    await arch.save(storage, existing);
    return `ADD: [${memory.id}] [${memory.category}] ${memory.content}`;
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
    const text = `${m.content} ${m.category}`.toLowerCase();
    const score = terms.filter((t) => text.includes(t)).length;
    return { ...m, score };
  });

  const results = scored.filter((m) => m.score > 0).sort((a, b) => b.score - a.score);
  if (results.length === 0) return `No memories matching "${query}".`;

  return results.map((m) => `[${m.id}] [${m.category}] ${m.content}`).join("\n");
}

export async function getAllMemories(
  storage: StorageAdapter,
  arch: MemoryArchitecture
): Promise<string> {
  return arch.loadRaw(storage);
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
