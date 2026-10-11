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

// --- Orders + reviews ---
import type { Order, ProductReviewSummary, ReviewableItem } from './types';

export const orderApi = {
  mine: () => api.get<Order[]>('/orders/my'),
};

export const reviewApi = {
  forProduct: (productId: number | string) =>
    api.get<ProductReviewSummary>(`/reviews/product/${productId}`),
  reviewable: () => api.get<ReviewableItem[]>('/reviews/reviewable'),
  submit: (body: { order_id: number; product_id: number; rating: number; comment?: string }) =>
    api.post(`/reviews`, body),
};

// --- Smart Pricing: view tracking ---
// Fire-and-forget - a missed ping just means one fewer view counted, never
// worth surfacing an error to the customer for. Uses fetch directly (not
// the request() helper above) since /pricing/track-view doesn't require -
// or want - an Authorization header; it needs to work for browsing
// customers who haven't logged in yet.
export function trackProductView(productId: number | string, viewerKey: string) {
  fetch(`${API_URL}/pricing/track-view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: Number(productId), viewer_key: viewerKey }),
  }).catch(() => {});
}

export { API_URL };
