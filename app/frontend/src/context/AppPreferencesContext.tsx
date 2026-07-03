import { createContext, useContext, useEffect, useState } from 'react';

export type LandingPage = '/' | '/calendar' | '/library' | '/stats';
export type CalendarView = 'month' | 'week';

type AppPreferences = {
  defaultCalendarView: CalendarView;
  defaultLandingPage: LandingPage;
  rememberLastLibraryFolder: boolean;
  lastLibraryPath: string;
};

type Ctx = AppPreferences & {
  setDefaultCalendarView: (view: CalendarView) => void;
  setDefaultLandingPage: (page: LandingPage) => void;
  setRememberLastLibraryFolder: (enabled: boolean) => void;
  setLastLibraryPath: (path: string) => void;
};

const STORAGE_KEY = 'oma:preferences';

const DEFAULTS: AppPreferences = {
  defaultCalendarView: 'month',
  defaultLandingPage: '/',
  rememberLastLibraryFolder: true,
  lastLibraryPath: '',
};

function readPreferences(): AppPreferences {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      defaultCalendarView:
        parsed.defaultCalendarView === 'week' || parsed.defaultCalendarView === 'month'
          ? parsed.defaultCalendarView
          : DEFAULTS.defaultCalendarView,
      defaultLandingPage:
        parsed.defaultLandingPage === '/' ||
        parsed.defaultLandingPage === '/calendar' ||
        parsed.defaultLandingPage === '/library' ||
        parsed.defaultLandingPage === '/stats'
          ? parsed.defaultLandingPage
          : DEFAULTS.defaultLandingPage,
      rememberLastLibraryFolder:
        typeof parsed.rememberLastLibraryFolder === 'boolean'
          ? parsed.rememberLastLibraryFolder
          : DEFAULTS.rememberLastLibraryFolder,
      lastLibraryPath: typeof parsed.lastLibraryPath === 'string' ? parsed.lastLibraryPath : '',
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

  return (
    <AppPreferencesContext.Provider
      value={{
        ...prefs,
        setDefaultCalendarView,
        setDefaultLandingPage,
        setRememberLastLibraryFolder,
        setLastLibraryPath,
      }}
    >
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  return useContext(AppPreferencesContext);
}
