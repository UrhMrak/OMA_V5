import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="row-gap">
      <div>
        <h2 className="h2">Settings</h2>
        <p className="muted">Manage your preferences for Orchestra Manager.</p>
      </div>

      <section className="card">
        <h3 className="h3">Appearance</h3>
        <div className="row-between">
          <div>
            <div className="card-title">Dark mode</div>
            <p className="muted small" style={{ margin: 0 }}>
              Switch between light and dark appearance.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label="Toggle dark mode"
            className={`theme-switch${isDark ? ' on' : ''}`}
            onClick={toggleTheme}
          >
            <span className="theme-switch-thumb" />
          </button>
        </div>
      </section>
    </div>
  );
}
