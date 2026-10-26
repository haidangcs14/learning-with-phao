"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/** Server state: GET with caching. Pass null to disable the query. */
export function useGet<T>(path: string | null) {
  return useQuery({
    queryKey: [path],
    queryFn: () => apiFetch<T>(path as string),
    enabled: path !== null,
    placeholderData: keepPreviousData,
  });
}

/** Mutation helper. `invalidate` = path prefixes whose cached queries must be refetched on success. */
export function useSend<T = unknown, V = void>(
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT",
  path: string | ((v: V) => string),
  invalidate: string[] = [],
  body?: (v: V) => unknown,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: V) => {
      const url = typeof path === "function" ? path(v) : path;
      const payload = body ? body(v) : v;
      const b = payload instanceof FormData ? payload
        : payload !== null && typeof payload === "object" ? JSON.stringify(payload) : undefined;
      return apiFetch<T>(url, { method, body: b });
    },
    onSuccess: () => {
      if (!invalidate.length) return;
      qc.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey[0];
          return typeof k === "string" && invalidate.some((p) => k.startsWith(p));
        },
      });
    },
  });
}
