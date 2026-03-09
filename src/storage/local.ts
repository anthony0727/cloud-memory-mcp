import { readFile, writeFile, mkdir, readdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { StorageAdapter } from "./base.js";

export class LocalAdapter implements StorageAdapter {
  private root: string;

  constructor(root?: string) {
    this.root = root ?? join(homedir(), ".cloud-memory");
  }

  private resolve(path: string): string {
    return join(this.root, path);
  }

  async read(path: string): Promise<string | null> {
    try {
      return await readFile(this.resolve(path), "utf-8");
    } catch {
      return null;
    }
  }

  async write(path: string, content: string): Promise<void> {
    const full = this.resolve(path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content, "utf-8");
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(this.resolve(path));
      return true;
    } catch {
      return false;
    }
  }

  async list(dir: string): Promise<string[]> {
    try {
      return await readdir(this.resolve(dir));
    } catch {
      return [];
    }
  }
}
