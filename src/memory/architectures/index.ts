import type { MemoryArchitecture } from "./base.js";
import { FlatArchitecture } from "./flat.js";

export type { MemoryArchitecture } from "./base.js";

const architectures: Record<string, () => MemoryArchitecture> = {
  flat: () => new FlatArchitecture(),
};

export function createArchitecture(name?: string): MemoryArchitecture {
  const key = name ?? process.env.CLOUD_MEMORY_ARCH ?? "flat";
  const factory = architectures[key];
  if (!factory) {
    console.error(`Unknown architecture "${key}", falling back to flat`);
    return new FlatArchitecture();
  }
  return factory();
}
