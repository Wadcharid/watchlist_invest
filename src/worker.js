/**
 * Cloudflare Worker Entrypoint
 * Handles API routes (/api/quote, /api/search, /api/data) and static asset delivery
 */
import { handleQuote } from './api/quote.js';
import { handleSearch } from './api/search.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API Routes
    if (url.pathname === '/api/quote' || url.pathname.startsWith('/api/quote')) {
      return handleQuote(request);
    }
    if (url.pathname === '/api/search' || url.pathname.startsWith('/api/search')) {
      return handleSearch(request);
    }
    if (url.pathname === '/api/data' || url.pathname.startsWith('/api/data')) {
      return handleQuote(request);
    }

    // Static Assets Fallback (Serves index.html, style.css, app.js, data/stocks.json)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};
