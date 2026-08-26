import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CatalogWork } from '../lib/types';
import { api } from '../lib/api';
import { sortWorks } from '../lib/catalog';
import { useAuth } from './AuthContext';

type CatalogContextValue = {
  works: CatalogWork[];
  loaded: boolean;
  error: string | null;
  loadCatalog: () => Promise<CatalogWork[]>;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const [works, setWorks] = useState<CatalogWork[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = role === 'admin';

  // The catalog endpoints are admin-only, so musicians never request them.
  // A failed request still has to settle `loaded`, because the page transition
  // keeps the catalog page hidden until the load reports it is done.
  const loadCatalog = useCallback(async () => {
    if (!isAdmin) return [];
    try {
      const data = await api.get<CatalogWork[]>('/api/catalog');
      const sorted = sortWorks(data || []);
      setWorks(sorted);
      setError(null);
      return sorted;
    } catch (err) {
      setWorks([]);
      setError(err instanceof Error && err.message ? err.message : String(err));
      return [];
    } finally {
      setLoaded(true);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setWorks([]);
      setError(null);
      setLoaded(false);
      return;
    }
    loadCatalog();
  }, [isAdmin, loadCatalog]);

  const value = useMemo(
    () => ({ works, loaded, error, loadCatalog }),
    [works, loaded, error, loadCatalog]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) {
    throw new Error('useCatalog must be used within CatalogProvider');
  }
  return ctx;
}
