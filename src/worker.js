/**
 * Cloudflare Worker Entrypoint
 * Handles both API routes and static asset serving
 */
import { onRequest as quoteHandler } from '../functions/api/quote.js';
import { onRequest as searchHandler } from '../functions/api/search.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API Routes
    if (url.pathname === '/api/quote' || url.pathname.startsWith('/api/quote')) {
      return quoteHandler({ request, env, ctx });
    }
    if (url.pathname === '/api/search' || url.pathname.startsWith('/api/search')) {
      return searchHandler({ request, env, ctx });
    }
    if (url.pathname === '/api/data' || url.pathname.startsWith('/api/data')) {
      return quoteHandler({ request, env, ctx });
    }

    // Static Assets Fallback
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
