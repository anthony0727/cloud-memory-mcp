interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // POST /token — exchange auth code for tokens
    if (url.pathname === "/token" && request.method === "POST") {
      const { code, redirect_uri } = await request.json<{ code: string; redirect_uri: string }>();

      if (!code || !redirect_uri) {
        return Response.json({ error: "missing code or redirect_uri" }, { status: 400, headers: CORS_HEADERS });
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenRes.json();
      return Response.json(tokens, { headers: CORS_HEADERS });
    }

    // POST /refresh — refresh an access token
    if (url.pathname === "/refresh" && request.method === "POST") {
      const { refresh_token } = await request.json<{ refresh_token: string }>();

      if (!refresh_token) {
        return Response.json({ error: "missing refresh_token" }, { status: 400, headers: CORS_HEADERS });
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          grant_type: "refresh_token",
        }),
      });

      const tokens = await tokenRes.json();
      return Response.json(tokens, { headers: CORS_HEADERS });
    }

    // GET /client-id — public endpoint so MCP server can get the client_id
    if (url.pathname === "/client-id") {
      return Response.json({ client_id: env.GOOGLE_CLIENT_ID }, { headers: CORS_HEADERS });
    }

    return Response.json({ error: "not found" }, { status: 404 });
  },
};
