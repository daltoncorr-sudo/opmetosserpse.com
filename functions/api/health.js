// GET /api/health: proves Pages Functions run after the move to Cloudflare Pages.
// Pages doesn't apply docs/_headers to Functions, so each Function sets its own headers.
export function onRequestGet() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
