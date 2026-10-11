const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const TOKEN_KEY = 'sellsence_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = (body && (body.error || body.message)) || `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: data !== undefined ? JSON.stringify(data) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// --- Ward market-expansion analysis endpoints ---
import type { Ward, WardClassifyResponse, BusinessReport, FinancialEstimate } from './types';

export const wardApi = {
  list: () => api.get<{ wards: Ward[] }>('/ward-analysis/wards'),
  saveAll: (wards: Partial<Ward>[]) =>
    api.post<{ wards: Ward[] }>('/ward-analysis/wards', { wards }),
  attachBoundary: (
    wardId: number,
    body: {
      boundary_geojson?: unknown;
      area_sq_km?: number;
      population_worldpop?: number;
      built_up_density_ghsl?: number;
    }
  ) => api.post<{ ward: Ward }>(`/ward-analysis/boundary/${wardId}`, body),
  classify: () => api.post<WardClassifyResponse>('/ward-analysis/classify'),
};

// --- Module 1: Local Business Report ---
export const businessReportApi = {
  generate: (params?: { near_km?: number; far_km?: number; avg_local_income?: number; language?: string }) => {
    const qs = new URLSearchParams();
    if (params?.near_km !== undefined) qs.set('near_km', String(params.near_km));
    if (params?.far_km !== undefined) qs.set('far_km', String(params.far_km));
    if (params?.avg_local_income !== undefined) qs.set('avg_local_income', String(params.avg_local_income));
    if (params?.language) qs.set('language', params.language);
    const query = qs.toString();
    return api.get<BusinessReport>(`/business-report${query ? `?${query}` : ''}`);
  },
};

// --- Module 3: Smart Competitor Word Analysis ---
import type { OwnWordAnalysis, RivalsResponse, CompetitorWordAnalysis, ExternalWordAnalysis } from './types';

export const wordAnalysisApi = {
  own: (ratingMax?: number) =>
    api.get<OwnWordAnalysis>(`/word-analysis/own${ratingMax ? `?rating_max=${ratingMax}` : ''}`),
  rivals: () => api.get<RivalsResponse>('/word-analysis/rivals'),
  vendor: (vendorId: number, ratingMax?: number) =>
    api.get<CompetitorWordAnalysis>(`/word-analysis/vendor/${vendorId}${ratingMax ? `?rating_max=${ratingMax}` : ''}`),
  external: (text: string, sourceLabel?: string) =>
    api.post<ExternalWordAnalysis>('/word-analysis/external', { text, source_label: sourceLabel }),
};

// --- Module 2: Smart Financial Calculator ---
export const financialCalculatorApi = {
  estimate: (body: {
    own_contribution: number;
    own_contribution_pct?: number;
    interest_rate_pct?: number;
    tenure_months?: number;
    moratorium_months?: number;
    monthly_operating_expenses?: number;
    working_capital_cycle_months?: number;
    micro_finance_max_project_cost?: number;
  }) => api.post<FinancialEstimate>('/financial-calculator/estimate', body),
};

// --- Module 4: Smart Pricing ---
import type { PricingSuggestionsResponse, PricingApplyResponse, PricingHistoryResponse } from './types';

export const pricingApi = {
  suggestions: () => api.get<PricingSuggestionsResponse>('/pricing/suggestions'),
  apply: (productId: number, newPrice: number, reason?: string) =>
    api.post<PricingApplyResponse>('/pricing/apply', { product_id: productId, new_price: newPrice, reason }),
  history: () => api.get<PricingHistoryResponse>('/pricing/history'),
};

export { API_URL };
