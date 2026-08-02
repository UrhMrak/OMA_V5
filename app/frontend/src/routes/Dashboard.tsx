import NewsList from '../components/Posts/NewsList';
import { useEffect, useMemo, useState } from 'react';
import { EventItem } from '../lib/types';
import { isSameLocalDay, formatWallTime, isEventInPulseWindow } from '../lib/date';
import { useEvents } from '../context/EventsContext';
import { useLanguage } from '../context/LanguageContext';
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
  const { events, loaded, loadEvents } = useEvents();
  const { t } = useLanguage();
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

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

  const renderEventList = (
    items: EventItem[],
    emptyMessage: string,
    pulseWhenActive = false
  ) => {
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
              <div
                className={`event-color${pulseWhenActive && isEventInPulseWindow(e.dateISO, e.endDateISO, now) ? ' event-color--pulse' : ''}`}
                style={{ background: e.color }}
              />
              <span className="muted small">{formatEventTimeRange(e.dateISO, e.endDateISO)}</span>
            </div>
            <div>
              <div className="card-title">{e.title}</div>
              {e.activity?.trim() && (
                <div className="dashboard-event-activity">{e.activity.trim()}</div>
              )}
              {e.venue?.trim() && (
                <div className="muted small dashboard-event-venue">{e.venue.trim()}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="grid grid-2 dashboard-grid">
      <section className="dashboard-news">
        <h2 className="h2">{t('dashboard.latestNews')}</h2>
        <NewsList />
      </section>
      <section className="dashboard-events">
        <h2 className="h2">{t('dashboard.todayEvents')}</h2>
        {renderEventList(todayEvents, t('dashboard.noToday'), true)}
        <h2 className="h2" style={{ marginTop: 24 }}>{t('dashboard.tomorrowEvents')}</h2>
        {renderEventList(tomorrowEvents, t('dashboard.noTomorrow'))}
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
