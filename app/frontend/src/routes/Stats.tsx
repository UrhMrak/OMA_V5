import { useEffect, useMemo, useState } from 'react';
import { EventItem } from '../lib/types';
import { api } from '../lib/api';
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
  label: string;
  value: (e: EventItem) => string;
  cellClassName?: string;
  truncate?: boolean;
};

const COLUMNS: StatsColumn[] = [
  { key: 'dateTime', label: 'Date & time', value: formatDateTime, cellClassName: 'stats-nowrap' },
  { key: 'title', label: 'Title', value: (e) => e.title || '' },
  { key: 'program', label: 'Program', value: (e) => e.program || '', cellClassName: 'stats-program', truncate: true },
  { key: 'conductor', label: 'Conductor', value: (e) => e.conductor || '' },
  { key: 'soloists', label: 'Soloist', value: (e) => e.soloists || '' },
  { key: 'otherParticipants', label: 'Other participants', value: (e) => e.otherParticipants || '' },
  { key: 'ensemble', label: 'Ensemble', value: (e) => e.ensemble || '' },
  { key: 'activity', label: 'Activity', value: (e) => e.activity || '' },
  { key: 'venue', label: 'Venue', value: (e) => e.venue || '' },
  { key: 'dress', label: 'Dress', value: (e) => e.dress || '' },
];

export default function Stats() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, true]))
  );

  useEffect(() => {
    api.get<EventItem[]>('/api/events').then(setEvents).finally(() => setLoaded(true));
  }, []);

  usePageReady(true);

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
      <h2 className="h2">Stats</h2>
      <input
        className="input stats-search"
        type="search"
        placeholder="Search all fields..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="stats-columns">
        <span className="muted small">Columns:</span>
        {COLUMNS.map((c) => (
          <label key={c.key} className="stats-column-toggle">
            <input
              type="checkbox"
              checked={!!visibleColumns[c.key]}
              onChange={() => toggleColumn(c.key)}
            />
            {c.label}
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
        <p className="muted">All columns are hidden. Enable at least one column to view data.</p>
      ) : (
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                {shownColumns.map((c) => (
                  <th key={c.key}>{c.label}</th>
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
        <p className="muted">{query.trim() ? 'No matching entries.' : 'No data available.'}</p>
      )}
    </div>
  );
}
