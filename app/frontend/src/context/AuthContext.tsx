import { createContext, useContext, useEffect, useState } from 'react';
import { setToken } from '../lib/api';

type Role = 'admin' | 'user' | null;
type Session = { username: string; role?: Exclude<Role, null> } | null;

function normalizeSession(raw: Session): Session {
  if (!raw?.username) return null;
  if (raw.role === 'admin' || raw.role === 'user') {
    return { username: raw.username, role: raw.role };
  }
  if (raw.username === 'admin') return { username: raw.username, role: 'admin' };
  if (raw.username === 'musician') return { username: raw.username, role: 'user' };
  return null;
}

type Ctx = {
  isAuthenticated: boolean;
  role: Role;
  username: string | null;
  setSession: (s: Session, token?: string) => void;
  clearSession: () => void;
};

const AuthContext = createContext<Ctx>({
  isAuthenticated: false,
  role: null,
  username: null,
  setSession: () => {},
  clearSession: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session>(null);

  useEffect(() => {
    const raw = localStorage.getItem('session');
    if (!raw) return;
    try {
      setSessionState(normalizeSession(JSON.parse(raw)));
    } catch {
      localStorage.removeItem('session');
    }
  }, []);

  function setSession(s: Session, token?: string) {
    const normalized = normalizeSession(s);
    setSessionState(normalized);
    if (normalized) {
      localStorage.setItem('session', JSON.stringify(normalized));
      if (token) setToken(token);
    } else {
      localStorage.removeItem('session');
      setToken(null);
    }
  }

  function clearSession() {
    setSession(null);
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!session,
        role: (session?.role as Role) || null,
        username: session?.username || null,
        setSession,
        clearSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}


