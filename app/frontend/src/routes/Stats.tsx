import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { EventItem } from '../lib/types';
import { useEvents } from '../context/EventsContext';
import { useLanguage } from '../context/LanguageContext';
import { usePageReady } from '../components/Layout/PageTransition';
import Skeleton from '../components/Layout/Skeleton';
import EventModal from '../components/Calendar/EventModal';
import { downloadCsv } from '../lib/csv';
import { formatEventHeadingDateTime } from '../lib/date';

type StatsColumn = {
  key: string;
  labelKey: string;
  value: (e: EventItem) => string;
  cellClassName?: string;
  truncate?: boolean;
};

const OTHER_COLUMNS: StatsColumn[] = [
  { key: 'title', labelKey: 'stats.col.title', value: (e) => e.title || '', cellClassName: 'stats-text' },
  { key: 'activity', labelKey: 'stats.col.activity', value: (e) => e.activity || '', cellClassName: 'stats-text' },
  { key: 'venue', labelKey: 'stats.col.venue', value: (e) => e.venue || '', cellClassName: 'stats-text' },
  { key: 'program', labelKey: 'stats.col.program', value: (e) => e.program || '', cellClassName: 'stats-program', truncate: true },
  { key: 'conductor', labelKey: 'stats.col.conductor', value: (e) => e.conductor || '', cellClassName: 'stats-text' },
  { key: 'soloists', labelKey: 'stats.col.soloists', value: (e) => e.soloists || '', cellClassName: 'stats-text' },
  { key: 'otherParticipants', labelKey: 'stats.col.otherParticipants', value: (e) => e.otherParticipants || '', cellClassName: 'stats-text' },
  { key: 'ensemble', labelKey: 'stats.col.ensemble', value: (e) => e.ensemble || '', cellClassName: 'stats-text' },
  { key: 'dress', labelKey: 'stats.col.dress', value: (e) => e.dress || '', cellClassName: 'stats-text', truncate: true },
  { key: 'other', labelKey: 'stats.col.other', value: (e) => e.other || '', cellClassName: 'stats-text', truncate: true },
];

type DateRangeFilter = 'all' | 'thisMonth' | 'next30' | 'custom';

function eventInRange(
  event: EventItem,
  filter: DateRangeFilter,
  customStart: string,
  customEnd: string
): boolean {
  const eventDate = new Date(event.dateISO);
  if (Number.isNaN(eventDate.getTime())) return false;

  const now = new Date();
  if (filter === 'all') return true;

  if (filter === 'thisMonth') {
    return eventDate.getFullYear() === now.getFullYear() && eventDate.getMonth() === now.getMonth();
  }

  if (filter === 'next30') {
    const end = new Date(now);
    end.setDate(end.getDate() + 30);
    end.setHours(23, 59, 59, 999);
    return eventDate >= now && eventDate <= end;
  }

  if (customStart) {
    const start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    if (eventDate < start) return false;
  }
  if (customEnd) {
    const end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
    if (eventDate > end) return false;
  }
  return true;
}

export default function Stats() {
  const { events, loaded, loadEvents } = useEvents();
  const { t, locale } = useLanguage();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(['dateTime', ...OTHER_COLUMNS.map((c) => c.key)].map((key) => [key, true]))
  );

  const columns = useMemo<StatsColumn[]>(
    () => [
      {
        key: 'dateTime',
        labelKey: 'stats.col.dateTime',
        value: (e) => formatEventHeadingDateTime(e.dateISO, e.endDateISO, locale),
        cellClassName: 'stats-nowrap',
      },
      ...OTHER_COLUMNS,
    ],
    [locale]
  );

  useEffect(() => {
    if (location.pathname === '/stats') {
      loadEvents();
    }
  }, [location.pathname, loadEvents]);

  usePageReady(loaded);

  const shownColumns = useMemo(
    () => columns.filter((c) => visibleColumns[c.key]),
    [columns, visibleColumns]
  );

  const rows = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    const term = query.trim().toLowerCase();
    return sorted.filter((event) => {
      if (!eventInRange(event, dateFilter, customStart, customEnd)) return false;
      if (!term) return true;
      const haystack = columns.map((c) => c.value(event))
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [events, query, dateFilter, customStart, customEnd, columns]);

  function toggleColumn(key: string) {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function exportRows() {
    if (rows.length === 0 || shownColumns.length === 0) return;
    const headers = shownColumns.map((c) => t(c.labelKey));
    const data = rows.map((event) => shownColumns.map((c) => c.value(event)));
    downloadCsv('orchestra-stats.csv', headers, data);
  }

  return (
    <div>
      <h2 className="h2">{t('stats.title')}</h2>
      <div className="stats-toolbar">
        <input
          className="input stats-search"
          type="search"
          placeholder={t('stats.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="btn"
          onClick={exportRows}
          disabled={rows.length === 0 || shownColumns.length === 0}
        >
          {t('stats.exportCsv')}
        </button>
      </div>
      <div className="stats-filters">
        <span className="muted small">{t('stats.dateRange')}</span>
        <div className="calendar-view-toggle calendar-view-toggle--compact" role="group" aria-label={t('stats.dateRange')}>
          {([
            ['all', t('stats.dateAll')],
            ['thisMonth', t('stats.dateThisMonth')],
            ['next30', t('stats.dateNext30')],
            ['custom', t('stats.dateCustom')],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={dateFilter === value ? 'active' : ''}
              aria-pressed={dateFilter === value}
              onClick={() => setDateFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {dateFilter === 'custom' && (
          <div className="stats-custom-range">
            <label className="stats-date-label">
              <span className="muted small">{t('stats.dateFrom')}</span>
              <input
                className="input"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </label>
            <label className="stats-date-label">
              <span className="muted small">{t('stats.dateTo')}</span>
              <input
                className="input"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </label>
          </div>
        )}
      </div>
      <div className="stats-columns">
        <span className="muted small">{t('stats.columns')}</span>
        {columns.map((c) => (
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
              {rows.map((event) => (
                <tr
                  key={event.id}
                  className="stats-row-clickable"
                  tabIndex={0}
                  role="button"
                  aria-label={t('stats.rowOpenAria')}
                  onClick={() => setSelectedEvent(event)}
                  onKeyDown={(keyboardEvent) => {
                    if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                      keyboardEvent.preventDefault();
                      setSelectedEvent(event);
                    }
                  }}
                >
                  {shownColumns.map((c) => {
                    const text = c.value(event);
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
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSave={() => {
            loadEvents();
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}
