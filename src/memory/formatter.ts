import { randomUUID } from "node:crypto";

export interface Memory {
  id: string;
  content: string;
  category: string;
  created_at: string;
}

export function parseMemories(md: string): Memory[] {
  const memories: Memory[] = [];
  let currentCategory = "general";

  for (const line of md.split("\n")) {
    const headerMatch = line.match(/^## (.+)$/);
    if (headerMatch) {
      currentCategory = headerMatch[1].trim();
      continue;
    }

    const memMatch = line.match(/^- \[(\d{4}-\d{2}-\d{2})\] \[([a-f0-9]{8,12})\] (.+)$/);
    if (memMatch) {
      memories.push({
        created_at: memMatch[1],
        id: memMatch[2],
        content: memMatch[3],
        category: currentCategory,
      });
    }
  }

  return memories;
}

export function formatMemories(memories: Memory[]): string {
  const grouped = new Map<string, Memory[]>();
  for (const m of memories) {
    const list = grouped.get(m.category) ?? [];
    list.push(m);
    grouped.set(m.category, list);
  }

  const lines: string[] = ["# memories.md", ""];
  for (const [cat, mems] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`## ${cat}`);
    for (const m of mems) {
      lines.push(`- [${m.created_at}] [${m.id}] ${m.content}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function newId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
