import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getEnvironmentalOverview,
  getEnvironmentalPlot,
} from './src/environmental/service.js'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const publicRoot = path.join(projectRoot, 'public')

function jsonResponse(response, status, payload) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

async function publicDataFetch(url) {
  const pathname = new URL(url, 'http://localhost').pathname
  const filePath = path.resolve(publicRoot, pathname.replace(/^\/+/, ''))
  if (!filePath.startsWith(`${publicRoot}${path.sep}`)) {
    return new Response('Not found', { status: 404 })
  }
  try {
    const body = await fs.readFile(filePath)
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}

function environmentalApiMiddleware() {
  return async (request, response, next) => {
    const requestUrl = new URL(request.url, 'http://localhost')
    const basePath = '/api/v1/environmental-intelligence'
    if (!requestUrl.pathname.startsWith(basePath)) {
      next()
      return
    }
    if (request.method !== 'GET') {
      jsonResponse(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'รองรับเฉพาะ GET' } })
      return
    }

    const options = {
      horizon: requestUrl.searchParams.get('horizon') || '24h',
      risk: requestUrl.searchParams.get('risk') || 'ALL',
      impact: requestUrl.searchParams.get('impact') || 'ALL',
      forceRefresh: requestUrl.searchParams.get('refresh') === '1',
      fetchImpl: publicDataFetch,
      providerEnv: process.env,
    }

    try {
      if (requestUrl.pathname === `${basePath}/overview`) {
        jsonResponse(response, 200, await getEnvironmentalOverview(options))
        return
      }
      const match = requestUrl.pathname.match(/^\/api\/v1\/environmental-intelligence\/plots\/(.+)$/)
      if (match) {
        jsonResponse(response, 200, await getEnvironmentalPlot(decodeURIComponent(match[1]), options))
        return
      }
      jsonResponse(response, 404, { error: { code: 'NOT_FOUND', message: 'ไม่พบ endpoint' } })
    } catch (error) {
      jsonResponse(response, 400, {
        error: { code: 'ENVIRONMENTAL_REQUEST_ERROR', message: error.message },
      })
    }
  }
}

function environmentalApiPlugin() {
  const install = (server) => {
    server.middlewares.use(environmentalApiMiddleware())
  }
  return {
    name: 'environmental-intelligence-api',
    configureServer: install,
    configurePreviewServer: install,
  }
}

export default defineConfig({
  plugins: [react(), environmentalApiPlugin()],
})
