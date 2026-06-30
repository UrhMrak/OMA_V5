import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { EventItem } from '../lib/types';
import { useEvents } from '../context/EventsContext';
import { useLanguage } from '../context/LanguageContext';
import { usePageReady } from '../components/Layout/PageTransition';
import Skeleton from '../components/Layout/Skeleton';

function formatDateTime(e: EventItem): string {
  const start = new Date(e.dateISO);
  if (Number.isNaN(start.getTime())) return '';
  const startText = start.toLocaleString();
  if (!e.endDateISO) return startText;
  const end = new Date(e.endDateISO);
  if (Number.isNaN(end.getTime())) return startText;
  return `${startText} – ${end.toLocaleString()}`;
}

type StatsColumn = {
  key: string;
  labelKey: string;
  value: (e: EventItem) => string;
  cellClassName?: string;
  truncate?: boolean;
};

const COLUMNS: StatsColumn[] = [
  { key: 'dateTime', labelKey: 'stats.col.dateTime', value: formatDateTime, cellClassName: 'stats-nowrap' },
  { key: 'title', labelKey: 'stats.col.title', value: (e) => e.title || '' },
  { key: 'activity', labelKey: 'stats.col.activity', value: (e) => e.activity || '' },
  { key: 'venue', labelKey: 'stats.col.venue', value: (e) => e.venue || '' },
  { key: 'program', labelKey: 'stats.col.program', value: (e) => e.program || '', cellClassName: 'stats-program', truncate: true },
  { key: 'conductor', labelKey: 'stats.col.conductor', value: (e) => e.conductor || '' },
  { key: 'soloists', labelKey: 'stats.col.soloists', value: (e) => e.soloists || '' },
  { key: 'otherParticipants', labelKey: 'stats.col.otherParticipants', value: (e) => e.otherParticipants || '' },
  { key: 'ensemble', labelKey: 'stats.col.ensemble', value: (e) => e.ensemble || '' },
  { key: 'dress', labelKey: 'stats.col.dress', value: (e) => e.dress || '' },
  { key: 'other', labelKey: 'stats.col.other', value: (e) => e.other || '' },
];

export default function Stats() {
  const { events, loaded, loadEvents } = useEvents();
  const { t } = useLanguage();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, true]))
  );

  useEffect(() => {
    if (location.pathname === '/stats') {
      loadEvents();
    }
  }, [location.pathname, loadEvents]);

  usePageReady(loaded);

  const shownColumns = useMemo(
    () => COLUMNS.filter((c) => visibleColumns[c.key]),
    [visibleColumns]
  );

  const rows = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    const term = query.trim().toLowerCase();
    if (!term) return sorted;
    return sorted.filter((e) => {
      const haystack = COLUMNS.map((c) => c.value(e))
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [events, query]);

  function toggleColumn(key: string) {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div>
      <h2 className="h2">{t('stats.title')}</h2>
      <input
        className="input stats-search"
        type="search"
        placeholder={t('stats.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="stats-columns">
        <span className="muted small">{t('stats.columns')}</span>
        {COLUMNS.map((c) => (
          <label key={c.key} className="stats-column-toggle">
            <input
              type="checkbox"
              checked={!!visibleColumns[c.key]}
              onChange={() => toggleColumn(c.key)}
            />
            {t(c.labelKey)}
          </label>
        ))}
      </div>
      {!loaded ? (
        <div className="skeleton-table">
          {Array.from({ length: 8 }).map((_, rowIndex) => (
            <div key={rowIndex} className="skeleton-table-row">
              {Array.from({ length: 5 }).map((_, colIndex) => (
                <Skeleton key={colIndex} />
              ))}
            </div>
          ))}
        </div>
      ) : shownColumns.length === 0 ? (
        <p className="muted">{t('stats.allHidden')}</p>
      ) : (
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                {shownColumns.map((c) => (
                  <th key={c.key}>{t(c.labelKey)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  {shownColumns.map((c) => {
                    const text = c.value(e);
                    return (
                      <td
                        key={c.key}
                        className={c.cellClassName}
                        title={c.truncate ? text : undefined}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {loaded && shownColumns.length > 0 && rows.length === 0 && (
        <p className="muted">{query.trim() ? t('stats.noMatching') : t('stats.noData')}</p>
      )}
    </div>
  );
}
