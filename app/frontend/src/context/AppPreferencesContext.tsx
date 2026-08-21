import { createContext, useContext, useEffect, useState } from 'react';

export type LandingPage = '/' | '/calendar' | '/library' | '/stage';
export type CalendarView = 'month' | 'week';

type AppPreferences = {
  defaultCalendarView: CalendarView;
  defaultLandingPage: LandingPage;
  rememberLastLibraryFolder: boolean;
  lastLibraryPath: string;
  compactEvents: boolean;
};

type Ctx = AppPreferences & {
  setDefaultCalendarView: (view: CalendarView) => void;
  setDefaultLandingPage: (page: LandingPage) => void;
  setRememberLastLibraryFolder: (enabled: boolean) => void;
  setLastLibraryPath: (path: string) => void;
  setCompactEvents: (enabled: boolean) => void;
};

const STORAGE_KEY = 'oma:preferences';
const LEGACY_EVENT_SIZE_KEY = 'oma:eventSize';

const DEFAULTS: AppPreferences = {
  defaultCalendarView: 'month',
  defaultLandingPage: '/',
  rememberLastLibraryFolder: true,
  lastLibraryPath: '',
  compactEvents: true,
};

function readLegacyCompactEvents(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(LEGACY_EVENT_SIZE_KEY);
    if (stored === 'compact') return true;
    if (stored === 'large') return false;
    return null;
  } catch {
    return null;
  }
}

function readCompactEvents(parsed: Partial<AppPreferences>): boolean {
  if (typeof parsed.compactEvents === 'boolean') {
    return parsed.compactEvents;
  }

  const legacy = readLegacyCompactEvents();
  if (legacy !== null) {
    return legacy;
  }

  return DEFAULTS.compactEvents;
}

function readPreferences(): AppPreferences {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = readLegacyCompactEvents();
      return {
        ...DEFAULTS,
        compactEvents: legacy ?? DEFAULTS.compactEvents,
      };
    }
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      defaultCalendarView:
        parsed.defaultCalendarView === 'week' || parsed.defaultCalendarView === 'month'
          ? parsed.defaultCalendarView
          : DEFAULTS.defaultCalendarView,
      defaultLandingPage:
        parsed.defaultLandingPage === '/stats'
          ? '/stage'
          : parsed.defaultLandingPage === '/' ||
              parsed.defaultLandingPage === '/calendar' ||
              parsed.defaultLandingPage === '/library' ||
              parsed.defaultLandingPage === '/stage'
            ? parsed.defaultLandingPage
            : DEFAULTS.defaultLandingPage,
      rememberLastLibraryFolder:
        typeof parsed.rememberLastLibraryFolder === 'boolean'
          ? parsed.rememberLastLibraryFolder
          : DEFAULTS.rememberLastLibraryFolder,
      lastLibraryPath: typeof parsed.lastLibraryPath === 'string' ? parsed.lastLibraryPath : '',
      compactEvents: readCompactEvents(parsed),
    };
  } catch {
    return DEFAULTS;
  }
}

const AppPreferencesContext = createContext<Ctx>({
  ...DEFAULTS,
  setDefaultCalendarView: () => {},
  setDefaultLandingPage: () => {},
  setRememberLastLibraryFolder: () => {},
  setLastLibraryPath: () => {},
  setCompactEvents: () => {},
});

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<AppPreferences>(readPreferences);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage failures; preference still applies for this session.
    }
  }, [prefs]);

  function setDefaultCalendarView(view: CalendarView) {
    setPrefs((current) => ({ ...current, defaultCalendarView: view }));
  }

  function setDefaultLandingPage(page: LandingPage) {
    setPrefs((current) => ({ ...current, defaultLandingPage: page }));
  }

  function setRememberLastLibraryFolder(enabled: boolean) {
    setPrefs((current) => ({ ...current, rememberLastLibraryFolder: enabled }));
  }

  function setLastLibraryPath(path: string) {
    setPrefs((current) => ({ ...current, lastLibraryPath: path }));
  }

  function setCompactEvents(enabled: boolean) {
    setPrefs((current) => ({ ...current, compactEvents: enabled }));
  }

  return (
    <AppPreferencesContext.Provider
      value={{
        ...prefs,
        setDefaultCalendarView,
        setDefaultLandingPage,
        setRememberLastLibraryFolder,
        setLastLibraryPath,
        setCompactEvents,
      }}
    >
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  return useContext(AppPreferencesContext);
}
