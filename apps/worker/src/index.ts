/**
 * Cloudflare Worker: API routes only (FR-13.2).
 * Static React assets are served by Workers Assets with SPA fallback.
 */

import { geminiProvider } from "./providers/gemini.js";
import { ProviderError } from "./providers/types.js";
import {
  MAX_BODY_BYTES,
  parseSuggestRequest,
  RequestError,
  suggest,
} from "./suggest.js";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' https://fonts.gstatic.com data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

export interface Env {
  GEMINI_API_KEY?: string;
  /** Model id, so it can be moved on without a code change (FR-10.1). */
  GEMINI_MODEL?: string;
  /** FR-10.7 — 20 requests a minute per IP; see wrangler.jsonc. */
  SUGGEST_LIMITER?: RateLimit;
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
      return handleSuggest(request, env);
    }

    return json({ error: "Unknown API route." }, 404);
  },
} satisfies ExportedHandler<Env>;

/**
 * FR-10 — the suggestion proxy.
 *
 * Nothing about the request is logged: the body carries a slide's image and
 * its surrounding text, which is course material belonging to the lecturer
 * (FR-10.7).
 */
async function handleSuggest(request: Request, env: Env): Promise<Response> {
  if (!sameOrigin(request)) {
    return json({ error: "Origin not allowed." }, 403);
  }

  const declaredLength = Number(request.headers.get("Content-Length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return json({ error: "That request is too large." }, 413);
  }

  if (env.SUGGEST_LIMITER) {
    const key =
      request.headers.get("CF-Connecting-IP") ?? "unknown-client";
    const { success } = await env.SUGGEST_LIMITER.limit({ key });
    if (!success) {
      return json(
        { error: "Too many suggestions at once. Wait a moment and try again." },
        429
      );
    }
  }

  if (!env.GEMINI_API_KEY) {
    return json(
      {
        error:
          "AI suggestions are not configured on this server. You can still write the text yourself and apply it.",
      },
      503
    );
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: "That request is too large." }, 413);
    }
    body = JSON.parse(raw);
  } catch {
    return json({ error: "That request was not valid JSON." }, 400);
  }

  try {
    const parsed = parseSuggestRequest(body);
    const provider = geminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL);
    return json(await suggest(provider, parsed));
  } catch (error) {
    if (error instanceof RequestError || error instanceof ProviderError) {
      return json({ error: error.message }, error.status);
    }
    return json(
      { error: "The suggestion could not be produced. Try again." },
      500
    );
  }
}
