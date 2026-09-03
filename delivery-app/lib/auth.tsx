import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getToken, clearToken, setUnauthorizedHandler } from "./api";

interface AuthContextValue {
  isLoading: boolean;
  isLoggedIn: boolean;
  setLoggedIn: (value: boolean) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    getToken().then((token) => {
      setIsLoggedIn(!!token);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setIsLoggedIn(false));
  }, []);

  async function logout() {
    await clearToken();
    setIsLoggedIn(false);
  }

  return (
    <AuthContext.Provider value={{ isLoading, isLoggedIn, setLoggedIn: setIsLoggedIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider.");
  return ctx;
}
