"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi, getAuthToken, setAuthToken, User } from "./api";
import { queryClient } from "./queryClient";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.me()
      .then(setUser)
      .catch(() => setAuthToken(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login: async (email, password) => {
      const result = await authApi.login({ email, password });
      setAuthToken(result.token);
      setUser(result.user);
      queryClient.invalidateQueries();
    },
    register: async (name, email, password) => {
      const result = await authApi.register({ name, email, password });
      setAuthToken(result.token);
      setUser(result.user);
      queryClient.invalidateQueries();
    },
    logout: async () => {
      try {
        await authApi.logout();
      } finally {
        setAuthToken(null);
        setUser(null);
        queryClient.clear();
      }
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
