/**
 * Cloudflare Pages Function: /api/data
 * Alias to quote handler for Cloudflare Pages (*.pages.dev)
 */
import { handleQuote } from '../../src/api/quote.js';

export async function onRequest(context) {
  return handleQuote(context.request);
}
