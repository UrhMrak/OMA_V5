import { useMemo, useState } from 'react';
import { CatalogWork } from '../lib/types';
import { useCatalog } from '../context/CatalogContext';
import { useLanguage } from '../context/LanguageContext';
import { usePageReady } from '../components/Layout/PageTransition';
import Skeleton from '../components/Layout/Skeleton';
import CatalogTable from '../components/Catalog/CatalogTable';
import CatalogItemModal from '../components/Catalog/CatalogItemModal';
import CatalogImportModal from '../components/Catalog/CatalogImportModal';
import {
  CATALOG_FIELDS,
  CatalogSortKey,
  SortDirection,
  searchCatalog,
  sortCatalog,
  toCsvRows,
} from '../lib/catalog';
import { downloadCsv } from '../lib/csv';

const CSV_FILENAME = 'music-catalog.csv';
const SKELETON_ROWS = 8;
const SKELETON_COLUMNS = 6;

export default function MusicCatalog() {
  const { works, loaded, error, loadCatalog } = useCatalog();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<CatalogSortKey>('composer');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedWork, setSelectedWork] = useState<CatalogWork | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  usePageReady(loaded);

  const rows = useMemo(
    () => sortCatalog(searchCatalog(works, query), sortKey, sortDirection),
    [works, query, sortKey, sortDirection]
  );

  function toggleSort(key: CatalogSortKey) {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  }

  function exportRows() {
    if (rows.length === 0) return;
    const headers = CATALOG_FIELDS.map((field) => t(field.labelKey));
    downloadCsv(CSV_FILENAME, headers, toCsvRows(rows));
  }

  function closeItemModal() {
    setSelectedWork(null);
    setIsCreating(false);
  }

  async function refreshAfterChange() {
    await loadCatalog();
    closeItemModal();
  }

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
        <button type="button" className="btn" onClick={exportRows} disabled={rows.length === 0}>
          {t('catalog.exportCsv')}
        </button>
      </div>

      {error && (
        <p className="error">
          {t('catalog.loadFailed')} {error}
        </p>
      )}

      {loaded && works.length > 0 && (
        <p className="muted small catalog-count">
          {t('catalog.count', { count: rows.length, total: works.length })}
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
      ) : rows.length > 0 ? (
        <CatalogTable
          works={rows}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={toggleSort}
          onSelect={setSelectedWork}
        />
      ) : error ? null : (
        <p className="muted">{query.trim() ? t('catalog.noResults') : t('catalog.noData')}</p>
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
            await loadCatalog();
          }}
        />
      )}
    </div>
  );
}
