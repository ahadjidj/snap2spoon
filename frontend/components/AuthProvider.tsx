"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, type User } from "@/lib/api";

type AuthState = {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
};

const AuthCtx = createContext<AuthState | null>(null);
const STORAGE_KEY = "snap2spoon.token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!saved) {
      setLoading(false);
      return;
    }
    setToken(saved);
    api.me(saved)
      .then(setUser)
      .catch(() => {
        window.localStorage.removeItem(STORAGE_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = (t: string, u: User) => {
    window.localStorage.setItem(STORAGE_KEY, t);
    setToken(t);
    setUser(u);
  };

  const login = useCallback(async (email: string, password: string) => {
    const { access_token, user } = await api.login(email, password);
    persist(access_token, user);
  }, []);

  const signup = useCallback(async (email: string, username: string, password: string) => {
    const { access_token, user } = await api.signup(email, username, password);
    persist(access_token, user);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, token, login, signup, logout, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
