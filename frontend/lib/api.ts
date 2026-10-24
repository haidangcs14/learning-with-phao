import { useAuth } from "@/store/auth-store";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export interface ApiMeta { page: number; limit: number; total: number; total_pages: number }
export interface ApiResponse<T> { success: boolean; data: T; message: string; meta: ApiMeta | null }

export class ApiError extends Error {
  constructor(public status: number, public errorCode: string, message: string) {
    super(message);
  }
}

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      useAuth.getState().clear();
      return false;
    }
    const body = await res.json();
    useAuth.getState().setSession(body.data.access_token, body.data.user);
    return true;
  } catch {
    return false;
  }
}

// One shared in-flight refresh: refresh tokens rotate, so concurrent refreshes would look like token theft.
let refreshing: Promise<boolean> | null = null;
function refreshSession(): Promise<boolean> {
  if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
  return refreshing;
}

export async function bootstrapSession(): Promise<void> {
  await refreshSession();
  useAuth.getState().setReady();
}

function authHeaders(init?: RequestInit): HeadersInit {
  const token = useAuth.getState().token;
  return {
    ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...init?.headers,
  };
}

export async function apiFetch<T>(path: string, init?: RequestInit, retry = true): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: authHeaders(init), credentials: "include" });
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refreshSession()) return apiFetch<T>(path, init, false);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error_code ?? "UNKNOWN", body?.message ?? res.statusText);
  return body as ApiResponse<T>;
}

export async function apiBlob(path: string): Promise<Blob> {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders(), credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, "BLOB_ERROR", "Could not download the file");
  return res.blob();
}

/** Authenticated fetch that returns the raw Response (used for streaming). Retries once after refreshing the session. */
export async function apiStream(path: string, init: RequestInit, retry = true): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: authHeaders(init), credentials: "include" });
  if (res.status === 401 && retry && (await refreshSession())) return apiStream(path, init, false);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error_code ?? "UNKNOWN", body?.message ?? res.statusText);
  }
  return res;
}
