import { createContext, useContext, useEffect, useState } from 'react';
import { setToken } from '../lib/api';

type Role = 'admin' | 'user' | null;
type Session = { username: string; role: Exclude<Role, null> } | null;

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
    if (raw) setSessionState(JSON.parse(raw));
  }, []);

  function setSession(s: Session, token?: string) {
    setSessionState(s);
    if (s) {
      localStorage.setItem('session', JSON.stringify(s));
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


