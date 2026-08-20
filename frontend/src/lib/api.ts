const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim();
function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizePath(pathname: string): string {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function apiUrl(pathname: string): string {
  const path = normalizePath(pathname);
  if (!API_BASE_URL) return path;
  return `${stripTrailingSlashes(API_BASE_URL)}${path}`;
}
