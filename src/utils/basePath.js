const configuredBase = import.meta.env?.BASE_URL || '/';

export const APP_BASE = configuredBase === '/'
  ? ''
  : configuredBase.replace(/\/+$/, '');

export const SITE_ROOT_PATH = APP_BASE ? `${APP_BASE}/` : '/';
export const ENVIRONMENTAL_PATH = `${APP_BASE}/environmental-intelligence`;

export function withBasePath(pathname) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${APP_BASE}${normalizedPath}`;
}

export function isEnvironmentalPath(pathname) {
  if (pathname === ENVIRONMENTAL_PATH) return true;
  return Boolean(
    APP_BASE
    && (pathname === APP_BASE || pathname === SITE_ROOT_PATH),
  );
}
