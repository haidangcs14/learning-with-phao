import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  token: string | null; // access token lives in memory only; refresh token is an HTTP-only cookie
  user: User | null;
  ready: boolean;
  setSession: (token: string, user: User) => void;
  clear: () => void;
  setReady: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  ready: false,
  setSession: (token, user) => set({ token, user, ready: true }),
  clear: () => set({ token: null, user: null, ready: true }),
  setReady: () => set({ ready: true }),
}));
