import { useEffect, useState } from 'react';
import { CatalogWork } from '../../lib/types';
import { api } from '../../lib/api';
import { useLanguage } from '../../context/LanguageContext';
import { useModalClose } from '../Layout/useModalClose';
import {
  CATALOG_PICKER_LIMIT,
  CatalogListPage,
  formatWorkLocations,
  formatWorkTitle,
} from '../../lib/catalog';

const SEARCH_DEBOUNCE_MS = 300;

export default function CatalogPickerModal({
  initialQuery,
  onSelect,
  onClose,
}: {
  initialQuery?: string;
  onSelect: (work: CatalogWork) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { closing, requestClose } = useModalClose(onClose);
  const [query, setQuery] = useState(initialQuery || '');
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery || '');
  const [results, setResults] = useState<CatalogWork[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      q: debouncedQuery.trim(),
      sort: 'composer',
      dir: 'asc',
      offset: '0',
      limit: String(CATALOG_PICKER_LIMIT),
    });

    (async () => {
      try {
        const page = await api.get<CatalogListPage>(`/api/catalog?${params.toString()}`);
        if (cancelled) return;
        setResults(page.works || []);
      } catch {
        if (cancelled) return;
        setResults([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  function choose(work: CatalogWork) {
    onSelect(work);
    requestClose();
  }

  return (
    <div className={`modal-backdrop ${closing ? 'closing' : ''}`} onClick={requestClose}>
      <div className={`modal ${closing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3 className="h3">{t('catalog.program.pickerTitle')}</h3>

        <div className="modal-body">
          <input
            className="input"
            type="search"
            autoFocus
            placeholder={t('catalog.program.pickerSearch')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className="muted small">{t('catalog.program.pickerHint')}</p>

          {!loaded ? (
            <p className="muted">{t('catalog.program.pickerSearching')}</p>
          ) : results.length === 0 ? (
            <p className="muted">{t('catalog.program.pickerEmpty')}</p>
          ) : (
            <ul className="catalog-picker-list">
              {results.map((work) => {
                const location = formatWorkLocations(work);
                return (
                  <li key={work.id}>
                    <button
                      type="button"
                      className="catalog-picker-item"
                      onClick={() => choose(work)}
                    >
                      <span className="catalog-picker-composer">{work.composer}</span>
                      <span className="catalog-picker-title">{formatWorkTitle(work)}</span>
                      <span className="catalog-picker-location muted small">
                        {location || t('catalog.program.noHolding')}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="row-between event-modal-actions">
          <div />
          <div className="event-modal-action-buttons">
            <button type="button" className="btn" onClick={requestClose}>
              {t('catalog.modal.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
