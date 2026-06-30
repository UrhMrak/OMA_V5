import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EventItem } from '../lib/types';
import { api } from '../lib/api';

type EventsContextValue = {
  events: EventItem[];
  loaded: boolean;
  loadEvents: () => Promise<void>;
};

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadEvents = useCallback(async () => {
    const data = await api.get<EventItem[]>('/api/events');
    setEvents(data);
    setLoaded(true);
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
