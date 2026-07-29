import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const serverRoot = path.join(projectRoot, 'dist', 'server');
const serverEntry = path.join(serverRoot, 'index.js');

const workerSource = `
const ORIGIN_TOKEN = '__SITE_ORIGIN__';

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function serveHtml(request, env) {
  const requestUrl = new URL(request.url);
  const indexRequest = new Request(new URL('/index.html', requestUrl), {
    method: 'GET',
    headers: request.headers,
  });
  const response = await env.ASSETS.fetch(indexRequest);
  if (!response.ok) return response;
  const html = (await response.text()).replaceAll(ORIGIN_TOKEN, requestUrl.origin);
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'public, max-age=0, must-revalidate');
  return new Response(html, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return Response.redirect(new URL('/environmental-intelligence', url), 302);
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: { code: 'STATIC_RUNTIME', message: 'Use browser-side live provider' } }, 404);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    const acceptsHtml = (request.headers.get('accept') || '').includes('text/html');
    const isRoute = !url.pathname.split('/').pop()?.includes('.');
    if (assetResponse.status === 404 && (acceptsHtml || isRoute)) {
      return serveHtml(request, env);
    }
    if (url.pathname === '/index.html' && assetResponse.ok) {
      const html = (await assetResponse.text()).replaceAll(ORIGIN_TOKEN, url.origin);
      const headers = new Headers(assetResponse.headers);
      headers.set('content-type', 'text/html; charset=utf-8');
      headers.set('cache-control', 'public, max-age=0, must-revalidate');
      return new Response(html, { status: assetResponse.status, headers });
    }
    return assetResponse;
  },
};
`;

await fs.mkdir(serverRoot, { recursive: true });
await fs.writeFile(serverEntry, workerSource.trimStart(), 'utf8');
