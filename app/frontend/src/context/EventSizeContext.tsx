import { createContext, useContext, useEffect, useState } from 'react';

type EventSize = 'large' | 'compact';

type Ctx = {
  eventSize: EventSize;
  toggleEventSize: () => void;
  setEventSize: (size: EventSize) => void;
};

const STORAGE_KEY = 'oma:eventSize';

const EventSizeContext = createContext<Ctx>({
  eventSize: 'compact',
  toggleEventSize: () => {},
  setEventSize: () => {},
});

function getInitialEventSize(): EventSize {
  if (typeof window === 'undefined') return 'compact';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'compact' || stored === 'large' ? stored : 'compact';
  } catch {
    return 'compact';
  }
}

export function EventSizeProvider({ children }: { children: React.ReactNode }) {
  const [eventSize, setEventSizeState] = useState<EventSize>(getInitialEventSize);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, eventSize);
    } catch {
      // Ignore storage failures; preference still applies for this session.
    }
  }, [eventSize]);

  function setEventSize(next: EventSize) {
    setEventSizeState(next);
  }

  function toggleEventSize() {
    setEventSizeState((current) => (current === 'large' ? 'compact' : 'large'));
  }

  return (
    <EventSizeContext.Provider value={{ eventSize, toggleEventSize, setEventSize }}>
      {children}
    </EventSizeContext.Provider>
  );
}

export function useEventSize() {
  return useContext(EventSizeContext);
}
