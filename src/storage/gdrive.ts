import { google, type drive_v3 } from "googleapis";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import type { StorageAdapter } from "./base.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TOKEN_PATH = join(homedir(), ".cloud-memory", "gdrive-token.json");
const CREDENTIALS_PATH = join(homedir(), ".cloud-memory-credentials.json");
const BUNDLED_CREDENTIALS_PATH = join(__dirname, "..", "..", "credentials.json");
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const FOLDER_NAME = "Cloud Memory";
const REDIRECT_URI = "http://localhost:3948/callback";

// default auth proxy — set CLOUD_MEMORY_AUTH_PROXY to override
const DEFAULT_AUTH_PROXY = "https://cloud-memory-auth.jwseok0727.workers.dev";

type AuthMode =
  | { mode: "direct"; client_id: string; client_secret: string }
  | { mode: "proxy"; client_id: string; proxy_url: string };

export class GDriveAdapter implements StorageAdapter {
  private drive: drive_v3.Drive | null = null;
  private folderId: string | null = null;
  private fileIdCache: Map<string, string> = new Map();
  private initPromise: Promise<void> | null = null;

  private async resolveAuthMode(): Promise<AuthMode> {
    // 1. env vars — direct mode
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      return { mode: "direct", client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET };
    }
    // 2. bundled or user credentials file — direct mode
    for (const path of [BUNDLED_CREDENTIALS_PATH, CREDENTIALS_PATH]) {
      try {
        const creds = JSON.parse(await readFile(path, "utf-8"));
        const { client_id, client_secret } = creds.installed ?? creds.web ?? creds;
        if (client_id && client_secret) return { mode: "direct", client_id, client_secret };
      } catch {}
    }
    // 3. auth proxy — secret stays on server
    const proxyUrl = process.env.CLOUD_MEMORY_AUTH_PROXY ?? DEFAULT_AUTH_PROXY;
    try {
      const res = await fetch(`${proxyUrl}/client-id`);
      const { client_id } = await res.json() as { client_id: string };
      if (client_id) return { mode: "proxy", client_id, proxy_url: proxyUrl };
    } catch {}

    throw new Error(
      "Google OAuth credentials not found and auth proxy unreachable.\n" +
      "Set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET, place credentials.json in project root,\n" +
      "or ensure the auth proxy is running."
    );
  }

  private async getAuth() {
    const authMode = await this.resolveAuthMode();

    if (authMode.mode === "direct") {
      return this.getAuthDirect(authMode.client_id, authMode.client_secret);
    } else {
      return this.getAuthViaProxy(authMode.client_id, authMode.proxy_url);
    }
  }

  private async getAuthDirect(clientId: string, clientSecret: string) {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

    try {
      const token = JSON.parse(await readFile(TOKEN_PATH, "utf-8"));
      oauth2.setCredentials(token);
    } catch {
      console.error("First run: opening browser for Google login...");
      const token = await this.authorizeInteractiveDirect(oauth2);
      oauth2.setCredentials(token);
    }

    oauth2.on("tokens", async (tokens) => {
      try {
        const existing = JSON.parse(await readFile(TOKEN_PATH, "utf-8").catch(() => "{}"));
        await mkdir(dirname(TOKEN_PATH), { recursive: true });
        await writeFile(TOKEN_PATH, JSON.stringify({ ...existing, ...tokens }), "utf-8");
      } catch (e) {
        console.error("Failed to save refreshed token:", e instanceof Error ? e.message : e);
      }
    });

    return oauth2;
  }

  private async getAuthViaProxy(clientId: string, proxyUrl: string) {
    const oauth2 = new google.auth.OAuth2(clientId, undefined, REDIRECT_URI);

    try {
      const token = JSON.parse(await readFile(TOKEN_PATH, "utf-8"));
      oauth2.setCredentials(token);
    } catch {
      console.error("First run: opening browser for Google login (via auth proxy)...");
      const token = await this.authorizeInteractiveProxy(clientId, proxyUrl);
      oauth2.setCredentials(token);
    }

    // refresh via proxy
    oauth2.on("tokens", async (tokens) => {
      try {
        const existing = JSON.parse(await readFile(TOKEN_PATH, "utf-8").catch(() => "{}"));
        await mkdir(dirname(TOKEN_PATH), { recursive: true });
        await writeFile(TOKEN_PATH, JSON.stringify({ ...existing, ...tokens }), "utf-8");
      } catch (e) {
        console.error("Failed to save refreshed token:", e instanceof Error ? e.message : e);
      }
    });

    // periodically refresh via proxy before token expires
    const refreshViaProxy = async () => {
      try {
        const creds = oauth2.credentials;
        if (!creds.refresh_token) return;
        const res = await fetch(`${proxyUrl}/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: creds.refresh_token }),
        });
        const tokens = await res.json() as any;
        oauth2.setCredentials({ ...creds, ...tokens });
        await mkdir(dirname(TOKEN_PATH), { recursive: true });
        await writeFile(TOKEN_PATH, JSON.stringify({ ...creds, ...tokens }), "utf-8");
      } catch (e) {
        console.error("Proxy token refresh failed:", e instanceof Error ? e.message : e);
      }
    };
    // refresh 5 min before expiry
    const expiryMs = oauth2.credentials.expiry_date;
    if (expiryMs) {
      const msUntilRefresh = expiryMs - Date.now() - 5 * 60 * 1000;
      if (msUntilRefresh > 0) {
        setTimeout(refreshViaProxy, msUntilRefresh);
      } else {
        await refreshViaProxy();
      }
    }

    return oauth2;
  }

  private authorizeInteractiveDirect(oauth2: InstanceType<typeof google.auth.OAuth2>): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = oauth2.generateAuthUrl({ access_type: "offline", scope: SCOPES, prompt: "consent" });

      const server = createServer(async (req, res) => {
        if (!req.url?.startsWith("/callback")) return;
        const code = new URL(req.url, "http://localhost:3948").searchParams.get("code");
        if (!code) { res.end("No code received."); return; }
        try {
          const { tokens } = await oauth2.getToken(code);
          await mkdir(dirname(TOKEN_PATH), { recursive: true });
          await writeFile(TOKEN_PATH, JSON.stringify(tokens), "utf-8");
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h1>Authenticated!</h1><p>Cloud Memory MCP is connected to your Google Drive. You can close this tab.</p>");
          server.close();
          resolve(tokens);
        } catch (e) {
          res.end("Authentication failed.");
          server.close();
          reject(e);
        }
      });

      server.listen(3948, () => {
        console.error(`\nGoogle login required. Opening browser...\n${url}\n`);
        import("open").then((m) => m.default(url)).catch(() => {
          console.error("Open the URL above manually.");
        });
      });
    });
  }

  private authorizeInteractiveProxy(clientId: string, proxyUrl: string): Promise<any> {
    return new Promise((resolve, reject) => {
      // build Google auth URL manually (no client_secret needed for auth URL)
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: SCOPES.join(" "),
        access_type: "offline",
        prompt: "consent",
      });
      const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

      const server = createServer(async (req, res) => {
        if (!req.url?.startsWith("/callback")) return;
        const code = new URL(req.url, "http://localhost:3948").searchParams.get("code");
        if (!code) { res.end("No code received."); return; }
        try {
          // exchange code via proxy (secret stays on proxy)
          const tokenRes = await fetch(`${proxyUrl}/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
          });
          const tokens = await tokenRes.json();
          await mkdir(dirname(TOKEN_PATH), { recursive: true });
          await writeFile(TOKEN_PATH, JSON.stringify(tokens), "utf-8");
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<h1>Authenticated!</h1><p>Cloud Memory MCP is connected to your Google Drive. You can close this tab.</p>");
          server.close();
          resolve(tokens);
        } catch (e) {
          res.end("Authentication failed.");
          server.close();
          reject(e);
        }
      });

      server.listen(3948, () => {
        console.error(`\nGoogle login required. Opening browser...\n${url}\n`);
        import("open").then((m) => m.default(url)).catch(() => {
          console.error("Open the URL above manually.");
        });
      });
    });
  }

  private async init() {
    if (!this.initPromise) {
      this.initPromise = this._doInit();
    }
    await this.initPromise;
  }

  private async _doInit(): Promise<void> {
    const auth = await this.getAuth();
    this.drive = google.drive({ version: "v3", auth });
    this.folderId = await this.getOrCreateFolder();
    console.error(`Google Drive connected. Folder: "${FOLDER_NAME}"`);
  }

  private async getOrCreateFolder(): Promise<string> {
    const safeName = FOLDER_NAME.replace(/'/g, "\\'");
    const res = await this.drive!.files.list({
      q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
    });
    if (res.data.files?.length) return res.data.files[0].id!;

    const folder = await this.drive!.files.create({
      requestBody: { name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" },
      fields: "id",
    });
    console.error(`Created "Cloud Memory" folder in Google Drive`);
    return folder.data.id!;
  }

  private async findFile(path: string): Promise<string | null> {
    if (this.fileIdCache.has(path)) return this.fileIdCache.get(path)!;

    await this.init();
    const safePath = path.replace(/'/g, "\\'");
    const res = await this.drive!.files.list({
      q: `name='${safePath}' and '${this.folderId}' in parents and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
    });
    const id = res.data.files?.[0]?.id ?? null;
    if (id) this.fileIdCache.set(path, id);
    return id;
  }

  async read(path: string): Promise<string | null> {
    await this.init();
    const fileId = await this.findFile(path);
    if (!fileId) return null;

    const res = await this.drive!.files.get({ fileId, alt: "media" }, { responseType: "text" });
    return res.data as string;
  }

  async write(path: string, content: string): Promise<void> {
    await this.init();
    const fileId = await this.findFile(path);
    const media = { mimeType: "text/markdown", body: content };

    if (fileId) {
      await this.drive!.files.update({ fileId, media });
    } else {
      const res = await this.drive!.files.create({
        requestBody: { name: path, parents: [this.folderId!] },
        media,
        fields: "id",
      });
      this.fileIdCache.set(path, res.data.id!);
    }
  }

  async delete(path: string): Promise<void> {
    await this.init();
    const fileId = await this.findFile(path);
    if (fileId) {
      await this.drive!.files.delete({ fileId });
      this.fileIdCache.delete(path);
    }
  }

  async exists(path: string): Promise<boolean> {
    return (await this.findFile(path)) !== null;
  }

  async search(query: string): Promise<string[]> {
    await this.init();
    const safeQuery = query.replace(/'/g, "\\'");
    const res = await this.drive!.files.list({
      q: `'${this.folderId}' in parents and trashed=false and fullText contains '${safeQuery}'`,
      fields: "files(name)",
      spaces: "drive",
    });
    return res.data.files?.map((f) => f.name!) ?? [];
  }

  async list(_dir: string): Promise<string[]> {
    await this.init();
    const res = await this.drive!.files.list({
      q: `'${this.folderId}' in parents and trashed=false`,
      fields: "files(name)",
      spaces: "drive",
    });
    return res.data.files?.map((f) => f.name!) ?? [];
  }
}
