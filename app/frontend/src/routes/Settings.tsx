import { useTheme } from '../context/ThemeContext';
import { useEventSize } from '../context/EventSizeContext';
import { useLanguage } from '../context/LanguageContext';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { eventSize, toggleEventSize } = useEventSize();
  const { language, setLanguage, t } = useLanguage();
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
            className={`theme-switch${isDark ? ' on' : ''}`}
            onClick={toggleTheme}
          >
            <span className="theme-switch-thumb" />
          </button>
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
            className={`theme-switch${isCompact ? ' on' : ''}`}
            onClick={toggleEventSize}
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
          <div className="calendar-view-toggle" role="group" aria-label={t('settings.language')}>
            <button
              type="button"
              className={language === 'en' ? 'active' : ''}
              aria-pressed={language === 'en'}
              onClick={() => setLanguage('en')}
            >
              {t('settings.english')}
            </button>
            <button
              type="button"
              className={language === 'is' ? 'active' : ''}
              aria-pressed={language === 'is'}
              onClick={() => setLanguage('is')}
            >
              {t('settings.icelandic')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
