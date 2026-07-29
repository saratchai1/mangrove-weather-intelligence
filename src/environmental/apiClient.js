import { ENVIRONMENTAL_API_ROUTES, getEnvironmentalOverview } from './service.js';

export async function fetchEnvironmentalOverview({
  horizon = '24h',
  risk = 'ALL',
  impact = 'ALL',
  forceRefresh = false,
} = {}) {
  const query = new URLSearchParams({ horizon, risk, impact });
  if (forceRefresh) query.set('refresh', '1');

  try {
    const response = await fetch(`${ENVIRONMENTAL_API_ROUTES.overview}?${query}`);
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) return response.json();
    if (response.status !== 404) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error?.message || 'โหลด Environmental Intelligence API ไม่สำเร็จ');
    }
  } catch (error) {
    if (!(error instanceof TypeError) && !(error instanceof SyntaxError)) throw error;
  }

  // Static-host fallback: preserve the same service contract when no backend
  // runtime is present. A production backend can replace this without UI changes.
  return getEnvironmentalOverview({ horizon, risk, impact, forceRefresh });
}
