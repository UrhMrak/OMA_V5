import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { LibraryNode } from '../lib/types';
import { api } from '../lib/api';
import FolderTree from '../components/Library/FolderTree';
import { useLanguage } from '../context/LanguageContext';
import { useAppPreferences } from '../context/AppPreferencesContext';
import { usePageReady } from '../components/Layout/PageTransition';
import Skeleton from '../components/Layout/Skeleton';

export default function Library() {
  const [tree, setTree] = useState<LibraryNode | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { t } = useLanguage();
  const location = useLocation();
  const { rememberLastLibraryFolder, lastLibraryPath, setLastLibraryPath } = useAppPreferences();

  usePageReady(true);

  const initialPath = useMemo(() => {
    const state = location.state as { targetLibraryPath?: string } | null;
    const statePath = state?.targetLibraryPath?.trim();
    const params = new URLSearchParams(location.search);
    const queryPath = params.get('path')?.trim();
    if (queryPath || statePath) return (queryPath || statePath) || undefined;
    if (rememberLastLibraryFolder && lastLibraryPath.trim()) return lastLibraryPath.trim();
    return undefined;
  }, [location.search, location.state, rememberLastLibraryFolder, lastLibraryPath]);

  async function refresh() {
    try {
      const nextTree = await api.get<LibraryNode>('/api/library/tree');
      setTree(nextTree);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div>
      <h2 className="h2">{t('library.title')}</h2>
      {!loaded || !tree ? (
        <div className="skeleton-folder-list">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="skeleton-folder" />
          ))}
        </div>
      ) : (
        <FolderTree
          node={tree}
          onRefresh={refresh}
          initialPath={initialPath}
          rememberLastFolder={rememberLastLibraryFolder}
          onLastFolderChange={setLastLibraryPath}
        />
      )}
    </div>
  );
}
