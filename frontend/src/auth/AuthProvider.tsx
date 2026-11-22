import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, ApiError, setUnauthorizedHandler } from "../api/client";
import type {
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  User,
} from "../api/types";

export type AuthStatus =
  | "loading"
  | "anonymous"
  | "authenticated"
  | "offline";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  sessionExpired: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  changePassword: (payload: ChangePasswordPayload) => Promise<void>;
  retry: () => void;
  clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const expireSession = useCallback(() => {
    setUser(null);
    setSessionExpired(true);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(expireSession);
    return () => setUnauthorizedHandler(null);
  }, [expireSession]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    api
      .me()
      .then((current) => {
        if (cancelled) {
          return;
        }
        setUser(current);
        setSessionExpired(false);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setUser(null);
        if (error instanceof ApiError && error.status === 401) {
          setStatus("anonymous");
        } else {
          setStatus("offline");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const login = useCallback(async (payload: LoginPayload) => {
    const current = await api.login(payload);
    setUser(current);
    setSessionExpired(false);
    setStatus("authenticated");
    return current;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const current = await api.register(payload);
    setUser(current);
    setSessionExpired(false);
    setStatus("authenticated");
    return current;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Даже если сервер недоступен, локально выходим из аккаунта.
    } finally {
      setUser(null);
      setSessionExpired(false);
      setStatus("anonymous");
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await api.logoutAll();
    } catch {
      // Локальный выход важнее ошибки сети: серверная сессия истечёт сама.
    } finally {
      setUser(null);
      setSessionExpired(false);
      setStatus("anonymous");
    }
  }, []);

  const changePassword = useCallback(async (payload: ChangePasswordPayload) => {
    await api.changePassword(payload);
  }, []);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const clearSessionExpired = useCallback(
    () => setSessionExpired(false),
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      sessionExpired,
      login,
      register,
      logout,
      logoutAll,
      changePassword,
      retry,
      clearSessionExpired,
    }),
    [
      status,
      user,
      sessionExpired,
      login,
      register,
      logout,
      logoutAll,
      changePassword,
      retry,
      clearSessionExpired,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth должен использоваться внутри AuthProvider");
  }
  return value;
}
