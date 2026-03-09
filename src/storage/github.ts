import { Octokit } from "@octokit/rest";
import type { StorageAdapter } from "./base.js";

const REPO_NAME = "my-ai-memory";

export class GitHubAdapter implements StorageAdapter {
  private octokit: Octokit;
  private owner: string | null = null;
  private shaCache: Map<string, string> = new Map();

  constructor(token?: string) {
    const t = token ?? process.env.GITHUB_TOKEN;
    if (!t) throw new Error("GITHUB_TOKEN required for GitHub storage backend");
    this.octokit = new Octokit({ auth: t });
  }

  private async getOwner(): Promise<string> {
    if (this.owner) return this.owner;
    const { data } = await this.octokit.users.getAuthenticated();
    this.owner = data.login;
    return this.owner;
  }

  private async ensureRepo(): Promise<void> {
    const owner = await this.getOwner();
    try {
      await this.octokit.repos.get({ owner, repo: REPO_NAME });
    } catch {
      await this.octokit.repos.createForAuthenticatedUser({
        name: REPO_NAME,
        private: true,
        auto_init: true,
        description: "Personal AI memory store (managed by cloud-memory-mcp)",
      });
    }
  }

  async read(path: string): Promise<string | null> {
    const owner = await this.getOwner();
    await this.ensureRepo();
    try {
      const { data } = await this.octokit.repos.getContent({ owner, repo: REPO_NAME, path });
      if ("content" in data) {
        this.shaCache.set(path, data.sha);
        return Buffer.from(data.content, "base64").toString("utf-8");
      }
      return null;
    } catch {
      return null;
    }
  }

  async write(path: string, content: string): Promise<void> {
    const owner = await this.getOwner();
    await this.ensureRepo();
    const sha = this.shaCache.get(path);

    // get current sha if not cached
    let currentSha = sha;
    if (!currentSha) {
      try {
        const { data } = await this.octokit.repos.getContent({ owner, repo: REPO_NAME, path });
        if ("sha" in data) currentSha = data.sha;
      } catch {
        // file doesn't exist yet
      }
    }

    const { data } = await this.octokit.repos.createOrUpdateFileContents({
      owner,
      repo: REPO_NAME,
      path,
      message: `update ${path}`,
      content: Buffer.from(content).toString("base64"),
      ...(currentSha ? { sha: currentSha } : {}),
    });
    if (data.content?.sha) this.shaCache.set(path, data.content.sha);
  }

  async delete(path: string): Promise<void> {
    const owner = await this.getOwner();
    await this.ensureRepo();
    try {
      const { data } = await this.octokit.repos.getContent({ owner, repo: REPO_NAME, path });
      if ("sha" in data) {
        await this.octokit.repos.deleteFile({ owner, repo: REPO_NAME, path, message: `delete ${path}`, sha: data.sha });
        this.shaCache.delete(path);
      }
    } catch {}
  }

  async exists(path: string): Promise<boolean> {
    const owner = await this.getOwner();
    await this.ensureRepo();
    try {
      await this.octokit.repos.getContent({ owner, repo: REPO_NAME, path });
      return true;
    } catch {
      return false;
    }
  }

  async list(dir: string): Promise<string[]> {
    const owner = await this.getOwner();
    await this.ensureRepo();
    try {
      const { data } = await this.octokit.repos.getContent({ owner, repo: REPO_NAME, path: dir || "" });
      if (Array.isArray(data)) return data.map((f) => f.name);
      return [];
    } catch {
      return [];
    }
  }
}
