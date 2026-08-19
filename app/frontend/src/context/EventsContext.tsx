import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { EventItem } from '../lib/types';
import { api } from '../lib/api';
import { eventsNeedProjectIdSync, syncProjectIdsForAllEvents } from '../lib/projectId';
import { useAuth } from './AuthContext';

type EventsContextValue = {
  events: EventItem[];
  loaded: boolean;
  loadEvents: () => Promise<EventItem[]>;
};

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const syncingProjectIdsRef = useRef(false);

  const loadEvents = useCallback(async () => {
    const data = await api.get<EventItem[]>('/api/events');
    setEvents(data);
    setLoaded(true);
    return data;
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadEvents();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadEvents]);

  useEffect(() => {
    if (!loaded || role !== 'admin' || syncingProjectIdsRef.current) return;
    if (!eventsNeedProjectIdSync(events)) return;

    let cancelled = false;
    syncingProjectIdsRef.current = true;

    (async () => {
      try {
        await syncProjectIdsForAllEvents(events);
        if (!cancelled) await loadEvents();
      } finally {
        syncingProjectIdsRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded, role, events, loadEvents]);

  const value = useMemo(
    () => ({ events, loaded, loadEvents }),
    [events, loaded, loadEvents]
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents() {
  const ctx = useContext(EventsContext);
  if (!ctx) {
    throw new Error('useEvents must be used within EventsProvider');
  }
  return ctx;
}
