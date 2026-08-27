import { useEffect, useState } from 'react';
import { CatalogWork } from '../lib/types';
import { api, API_BASE, authHeaders } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';
import { usePageReady } from '../components/Layout/PageTransition';
import Skeleton from '../components/Layout/Skeleton';
import CatalogTable from '../components/Catalog/CatalogTable';
import CatalogItemModal from '../components/Catalog/CatalogItemModal';
import CatalogImportModal from '../components/Catalog/CatalogImportModal';
import {
  CATALOG_PAGE_SIZE,
  CatalogListPage,
  CatalogSortKey,
  SortDirection,
} from '../lib/catalog';

const CSV_FILENAME = 'music-catalog.csv';
const SKELETON_ROWS = 8;
const SKELETON_COLUMNS = 6;
const SEARCH_DEBOUNCE_MS = 300;

export default function MusicCatalog() {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortKey, setSortKey] = useState<CatalogSortKey>('composer');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [offset, setOffset] = useState(0);
  const [works, setWorks] = useState<CatalogWork[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedWork, setSelectedWork] = useState<CatalogWork | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  usePageReady(loaded);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query);
      setOffset(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      q: debouncedQuery.trim(),
      sort: sortKey,
      dir: sortDirection,
      offset: String(offset),
      limit: String(CATALOG_PAGE_SIZE),
    });

    (async () => {
      try {
        const page = await api.get<CatalogListPage>(`/api/catalog?${params.toString()}`);
        if (cancelled) return;
        setWorks(page.works || []);
        setTotal(page.total || 0);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setWorks([]);
        setTotal(0);
        setError(err instanceof Error && err.message ? err.message : String(err));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, sortKey, sortDirection, offset]);

  async function loadPage(nextOffset = offset) {
    const params = new URLSearchParams({
      q: debouncedQuery.trim(),
      sort: sortKey,
      dir: sortDirection,
      offset: String(nextOffset),
      limit: String(CATALOG_PAGE_SIZE),
    });
    const page = await api.get<CatalogListPage>(`/api/catalog?${params.toString()}`);
    setWorks(page.works || []);
    setTotal(page.total || 0);
    setError(null);
    setLoaded(true);
  }

  useEffect(() => {
    if (loaded && works.length === 0 && offset > 0) {
      setOffset(Math.max(0, offset - CATALOG_PAGE_SIZE));
    }
  }, [loaded, works.length, offset]);

  function toggleSort(key: CatalogSortKey) {
    setOffset(0);
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  }

  async function exportRows() {
    if (isExporting || total === 0) return;
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        q: debouncedQuery.trim(),
        sort: sortKey,
        dir: sortDirection,
      });
      const response = await fetch(`${API_BASE}/api/catalog/export?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!response.ok) {
        throw new Error((await response.text()) || response.statusText);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = CSV_FILENAME;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  }

  function closeItemModal() {
    setSelectedWork(null);
    setIsCreating(false);
  }

  async function refreshAfterChange() {
    await loadPage();
    closeItemModal();
  }

  const from = total === 0 ? 0 : offset + 1;
  const to = offset + works.length;
  const pageCount = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const pageNumber = Math.floor(offset / CATALOG_PAGE_SIZE) + 1;
  const canPrev = offset > 0;
  const canNext = offset + works.length < total;

  return (
    <div>
      <h2 className="h2">{t('catalog.title')}</h2>

      <div className="stats-toolbar">
        <input
          className="input stats-search"
          type="search"
          placeholder={t('catalog.search')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className="btn primary" onClick={() => setIsCreating(true)}>
          {t('catalog.addWork')}
        </button>
        <button type="button" className="btn" onClick={() => setIsImporting(true)}>
          {t('catalog.importCsv')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => void exportRows()}
          disabled={total === 0 || isExporting}
        >
          {t('catalog.exportCsv')}
        </button>
      </div>

      {error && (
        <p className="error">
          {t('catalog.loadFailed')} {error}
        </p>
      )}

      {loaded && total > 0 && (
        <p className="muted small catalog-count">
          {t('catalog.count', { from, to, total })}
        </p>
      )}

      {!loaded ? (
        <div className="skeleton-table">
          {Array.from({ length: SKELETON_ROWS }).map((_, rowIndex) => (
            <div key={rowIndex} className="skeleton-table-row">
              {Array.from({ length: SKELETON_COLUMNS }).map((_, columnIndex) => (
                <Skeleton key={columnIndex} />
              ))}
            </div>
          ))}
        </div>
      ) : works.length > 0 ? (
        <CatalogTable
          works={works}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={toggleSort}
          onSelect={setSelectedWork}
        />
      ) : error ? null : (
        <p className="muted">{query.trim() ? t('catalog.noResults') : t('catalog.noData')}</p>
      )}

      {loaded && total > CATALOG_PAGE_SIZE && (
        <div className="catalog-pager">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setOffset(Math.max(0, offset - CATALOG_PAGE_SIZE))}
            disabled={!canPrev}
          >
            {t('catalog.pagePrevious')}
          </button>
          <span className="muted small">
            {t('catalog.pageStatus', { page: pageNumber, pages: pageCount })}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setOffset(offset + CATALOG_PAGE_SIZE)}
            disabled={!canNext}
          >
            {t('catalog.pageNext')}
          </button>
        </div>
      )}

      {(selectedWork || isCreating) && (
        <CatalogItemModal
          work={selectedWork}
          onClose={closeItemModal}
          onSaved={refreshAfterChange}
        />
      )}

      {isImporting && (
        <CatalogImportModal
          onClose={() => setIsImporting(false)}
          onImported={async () => {
            if (offset === 0) await loadPage(0);
            else setOffset(0);
          }}
        />
      )}
    </div>
  );
}
