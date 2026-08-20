import { useTheme } from '../context/ThemeContext';
import { useEventSize } from '../context/EventSizeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAppPreferences, LandingPage, CalendarView } from '../context/AppPreferencesContext';
import { useTextSize, TextSize } from '../context/TextSizeContext';

const TEXT_SIZE_OPTIONS: Array<{ value: TextSize; labelKey: string }> = [
  { value: 'default', labelKey: 'settings.textSizeDefault' },
  { value: 'large', labelKey: 'settings.textSizeLarge' },
  { value: 'extra-large', labelKey: 'settings.textSizeExtraLarge' },
];

const LANDING_OPTIONS: Array<{ value: LandingPage; labelKey: string }> = [
  { value: '/', labelKey: 'settings.landingDashboard' },
  { value: '/calendar', labelKey: 'settings.landingCalendar' },
  { value: '/library', labelKey: 'settings.landingLibrary' },
  { value: '/stage', labelKey: 'settings.landingStage' },
];

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { eventSize, toggleEventSize } = useEventSize();
  const { textSize, setTextSize } = useTextSize();
  const { language, setLanguage, t } = useLanguage();
  const {
    defaultCalendarView,
    defaultLandingPage,
    rememberLastLibraryFolder,
    setDefaultCalendarView,
    setDefaultLandingPage,
    setRememberLastLibraryFolder,
  } = useAppPreferences();
  const isDark = theme === 'dark';
  const isCompact = eventSize === 'compact';

  return (
    <div className="row-gap">
      <div>
        <h2 className="h2">{t('settings.title')}</h2>
        <p className="muted">{t('settings.subtitle')}</p>
      </div>

      <section className="card">
        <h3 className="h3">{t('settings.appearance')}</h3>
        <div className="row-between">
          <div>
            <div className="card-title">{t('settings.darkMode')}</div>
            <p className="muted small" style={{ margin: 0 }}>
              {t('settings.darkModeDesc')}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label={t('settings.darkModeToggle')}
            className={`theme-switch theme-switch--compact${isDark ? ' on' : ''}`}
            onClick={toggleTheme}
          >
            <span className="theme-switch-thumb" />
          </button>
        </div>
        <div className="row-between settings-preference-row">
          <div>
            <div className="card-title">{t('settings.textSize')}</div>
            <p className="muted small" style={{ margin: 0 }}>
              {t('settings.textSizeDesc')}
            </p>
          </div>
          <div
            className="calendar-view-toggle calendar-view-toggle--compact settings-text-size-toggle"
            role="group"
            aria-label={t('settings.textSize')}
          >
            {TEXT_SIZE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={textSize === option.value ? 'active' : ''}
                aria-pressed={textSize === option.value}
                onClick={() => setTextSize(option.value)}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="h3">{t('settings.calendar')}</h3>
        <div className="row-between">
          <div>
            <div className="card-title">{t('settings.compactEvents')}</div>
            <p className="muted small" style={{ margin: 0 }}>
              {t('settings.compactDesc')}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isCompact}
            aria-label={t('settings.compactToggle')}
            className={`theme-switch theme-switch--compact${isCompact ? ' on' : ''}`}
            onClick={toggleEventSize}
          >
            <span className="theme-switch-thumb" />
          </button>
        </div>
        <div className="row-between settings-preference-row">
          <div>
            <div className="card-title">{t('settings.defaultCalendarView')}</div>
            <p className="muted small" style={{ margin: 0 }}>
              {t('settings.defaultCalendarViewDesc')}
            </p>
          </div>
          <div className="calendar-view-toggle calendar-view-toggle--compact" role="group" aria-label={t('settings.defaultCalendarView')}>
            {(['month', 'week'] as CalendarView[]).map((view) => (
              <button
                key={view}
                type="button"
                className={defaultCalendarView === view ? 'active' : ''}
                aria-pressed={defaultCalendarView === view}
                onClick={() => setDefaultCalendarView(view)}
              >
                {t(view === 'month' ? 'calendar.month' : 'calendar.week')}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="h3">{t('settings.navigation')}</h3>
        <div className="row-between settings-preference-row">
          <div>
            <div className="card-title">{t('settings.defaultLandingPage')}</div>
            <p className="muted small" style={{ margin: 0 }}>
              {t('settings.defaultLandingDesc')}
            </p>
          </div>
          <div className="calendar-view-toggle calendar-view-toggle--compact settings-landing-toggle" role="group" aria-label={t('settings.defaultLandingPage')}>
            {LANDING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={defaultLandingPage === option.value ? 'active' : ''}
                aria-pressed={defaultLandingPage === option.value}
                onClick={() => setDefaultLandingPage(option.value)}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>
        <div className="row-between settings-navigation-follow">
          <div>
            <div className="card-title">{t('settings.rememberLibraryFolder')}</div>
            <p className="muted small" style={{ margin: 0 }}>
              {t('settings.rememberLibraryFolderDesc')}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={rememberLastLibraryFolder}
            aria-label={t('settings.rememberLibraryFolder')}
            className={`theme-switch theme-switch--compact${rememberLastLibraryFolder ? ' on' : ''}`}
            onClick={() => setRememberLastLibraryFolder(!rememberLastLibraryFolder)}
          >
            <span className="theme-switch-thumb" />
          </button>
        </div>
      </section>

      <section className="card">
        <h3 className="h3">{t('settings.language')}</h3>
        <div className="row-between">
          <div>
            <div className="card-title">{t('settings.language')}</div>
            <p className="muted small" style={{ margin: 0 }}>
              {t('settings.languageDesc')}
            </p>
          </div>
          <div className="calendar-view-toggle calendar-view-toggle--compact" role="group" aria-label={t('settings.language')}>
            <button
              type="button"
              className={language === 'en' ? 'active' : ''}
              aria-pressed={language === 'en'}
              aria-label={t('settings.english')}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={language === 'is' ? 'active' : ''}
              aria-pressed={language === 'is'}
              aria-label={t('settings.icelandic')}
              onClick={() => setLanguage('is')}
            >
              IS
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
