/**
 * Cloudflare Worker: API routes only (FR-13.2).
 * Static React assets are served by Workers Assets with SPA fallback.
 */

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' https://fonts.gstatic.com data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

export interface Env {
  GEMINI_API_KEY?: string;
  ASSETS?: Fetcher;
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(
    Response.json(data, {
      status,
      headers: { "Cache-Control": "no-store" },
    })
  );
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) {
    // Same-origin navigations and some clients omit Origin.
    return true;
  }
  return origin === new URL(request.url).origin;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return withSecurityHeaders(new Response("Not found", { status: 404 }));
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "accessibility-workbench",
        geminiConfigured: Boolean(env.GEMINI_API_KEY),
      });
    }

    if (url.pathname === "/api/suggest" && request.method === "POST") {
      if (!sameOrigin(request)) {
        return json({ error: "Origin not allowed." }, 403);
      }

      // Milestone 1 scaffold: real Gemini proxy lands with FR-10.
      return json(
        {
          error:
            "AI suggestions are not enabled yet. They arrive with the Workbench fix panel.",
        },
        501
      );
    }

    return json({ error: "Unknown API route." }, 404);
  },
} satisfies ExportedHandler<Env>;
