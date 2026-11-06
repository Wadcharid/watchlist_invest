/**
 * Cloudflare Pages Function: /api/quote
 * For Cloudflare Pages (*.pages.dev) deployment
 */
import { handleQuote } from '../../src/api/quote.js';

export async function onRequest(context) {
  return handleQuote(context.request);
}
