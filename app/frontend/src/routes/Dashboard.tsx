import NewsList from '../components/Posts/NewsList';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EventItem } from '../lib/types';
import { isSameLocalDay, formatWallTime } from '../lib/date';
import { api } from '../lib/api';
import EventModal from '../components/Calendar/EventModal';
import { usePageReady } from '../components/Layout/PageTransition';
import { SkeletonCardList } from '../components/Layout/Skeleton';

function formatEventTimeRange(
  startISO: string | null | undefined,
  endISO: string | null | undefined
): string {
  const start = formatWallTime(startISO);
  const end = formatWallTime(endISO);
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

export default function Dashboard() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      const data = await api.get<EventItem[]>('/api/events');
      setEvents(data);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  usePageReady(true);

  const { todayEvents, tomorrowEvents } = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      todayEvents: events.filter((e) => isSameLocalDay(e.dateISO, today)),
      tomorrowEvents: events.filter((e) => isSameLocalDay(e.dateISO, tomorrow)),
    };
  }, [events]);

  const renderEventList = (items: EventItem[], emptyMessage: string) => {
    if (!loaded) return <SkeletonCardList count={2} />;
    if (items.length === 0) return <p className="muted">{emptyMessage}</p>;
    return (
      <ul className="card-list">
        {items.map((e) => (
          <li
            key={e.id}
            className="card"
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            onClick={() => setSelectedEvent(e)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedEvent(e);
              }
            }}
          >
            <div className="row" style={{ alignItems: 'center', gap: 6 }}>
              <div className="event-color" style={{ background: e.color }} />
              <span className="muted small">{formatEventTimeRange(e.dateISO, e.endDateISO)}</span>
            </div>
            <div>
              <div className="card-title">{e.title}</div>
              <div className="muted small">{e.program}</div>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="grid grid-2">
      <section>
        <h2 className="h2">Latest News</h2>
        <NewsList />
      </section>
      <section>
        <h2 className="h2">Today's Events</h2>
        {renderEventList(todayEvents, 'No events scheduled for today.')}
        <h2 className="h2" style={{ marginTop: 24 }}>Tomorrow's Events</h2>
        {renderEventList(tomorrowEvents, 'No events scheduled for tomorrow.')}
      </section>
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
