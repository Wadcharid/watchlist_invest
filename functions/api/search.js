/**
 * Cloudflare Pages Function: /api/search
 * For Cloudflare Pages (*.pages.dev) deployment
 */
import { handleSearch } from '../../src/api/search.js';

export async function onRequest(context) {
  return handleSearch(context.request);
}
