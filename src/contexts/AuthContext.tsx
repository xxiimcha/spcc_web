import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";

export interface User {
  id: string;
  username: string;
  role: "admin" | "school_head";
  email?: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  isAdmin: boolean;
  isSchoolHead: boolean;
}

const USER_KEY = "user";
const ROLE_KEY = "role";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Lazy init from localStorage (client only)
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      // Corrupt JSON or unexpected value
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(ROLE_KEY);
      return null;
    }
  });

  // Optional: keep multiple tabs in sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === USER_KEY) {
        try {
          setUser(e.newValue ? (JSON.parse(e.newValue) as User) : null);
        } catch {
          setUser(null);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    localStorage.setItem(ROLE_KEY, userData.role);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
  };

  const value = useMemo<AuthContextType>(() => ({
    user,
    isAuthenticated: !!user,
    login,
    logout,
    isAdmin: user?.role === "admin",
    isSchoolHead: user?.role === "school_head",
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
