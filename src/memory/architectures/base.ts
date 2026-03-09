import type { StorageAdapter } from "../../storage/base.js";
import type { Memory } from "../formatter.js";

export interface MemoryArchitecture {
  name: string;
  load(storage: StorageAdapter): Promise<Memory[]>;
  save(storage: StorageAdapter, memories: Memory[]): Promise<void>;
  loadRaw(storage: StorageAdapter): Promise<string>;
}
