const ML_API_BASE_URL = (import.meta.env.VITE_ML_API_BASE_URL || 'https://sih-2026-kg5u.onrender.com').trim();

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizePath(pathname: string): string {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function mlApiUrl(pathname: string): string {
  const path = normalizePath(pathname);
  if (!ML_API_BASE_URL) return path;
  return `${stripTrailingSlashes(ML_API_BASE_URL)}${path}`;
}

/**
 * Placeholder forecast request interface for future ML predictions integration.
 */
export async function fetchForecastProjectedGrid(month: string, year: number): Promise<any> {
  const url = mlApiUrl(`/api/forecast?month=${month}&year=${year}`);
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`ML forecast API error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`Future ML prediction integration is offline. Url: ${url}`);
    return {
      month,
      year,
      predictions: [],
      error: (error as Error).message,
    };
  }
}
