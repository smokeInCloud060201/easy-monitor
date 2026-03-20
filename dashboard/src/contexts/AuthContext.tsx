import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface User {
  sub: string;
  role: string;
  exp: number;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function decodeToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) {
      return null; // expired
    }
    return { sub: payload.sub, role: payload.role, exp: payload.exp };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('auth_token');
    return stored ? decodeToken(stored) : null;
  });

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback((newToken: string) => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    const decoded = decodeToken(newToken);
    if (decoded) {
      setUser(decoded);
    }
  }, []);

  useEffect(() => {
    if (token) {
      const decoded = decodeToken(token);
      if (!decoded) {
        logout();
      } else {
        setUser(decoded);
      }
    }
  }, [token, logout]);

  // Periodically check token expiry
  useEffect(() => {
    const interval = setInterval(() => {
      if (token) {
        const decoded = decodeToken(token);
        if (!decoded) {
          logout();
        }
      }
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
