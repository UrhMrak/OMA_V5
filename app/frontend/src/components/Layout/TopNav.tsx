import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../lib/api';
import SettingsIcon from '../icons/SettingsIcon';

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`nav-dropdown-chevron${expanded ? ' expanded' : ''}`}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function TopNav() {
  const { username, clearSession } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [statsMenuOpen, setStatsMenuOpen] = useState(false);
  const statsMenuRef = useRef<HTMLDivElement>(null);
  const isStatsRoute = location.pathname === '/stats' || location.pathname.startsWith('/stats/');

  useEffect(() => {
    setMenuOpen(false);
    setStatsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!statsMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!statsMenuRef.current?.contains(event.target as Node)) {
        setStatsMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setStatsMenuOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [statsMenuOpen]);

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen);
    return () => {
      document.body.classList.remove('nav-open');
    };
  }, [menuOpen]);

  async function logout() {
    await api.post('/api/auth/logout', {});
    clearSession();
    navigate('/login');
  }

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link to="/" className="brand">
          <img
            className="brand-logo"
            src={`${import.meta.env.BASE_URL}sitelogosmall.svg`}
            alt=""
            aria-hidden="true"
          />
          <span>ISO Orchestra Manager</span>
        </Link>

        <button
          type="button"
          className={`nav-toggle${menuOpen ? ' open' : ''}`}
          aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>

        <div id="primary-navigation" className={`nav-collapse${menuOpen ? ' open' : ''}`}>
          <nav className="nav">
            <NavLink to="/" end>{t('nav.home')}</NavLink>
            <NavLink to="/calendar">{t('nav.calendar')}</NavLink>
            <NavLink to="/library">{t('nav.library')}</NavLink>
            <NavLink to="/stage">{t('nav.stage')}</NavLink>
            <div className="nav-dropdown" ref={statsMenuRef}>
              <button
                type="button"
                className={`nav-dropdown-trigger${isStatsRoute ? ' active' : ''}`}
                aria-expanded={statsMenuOpen}
                aria-haspopup="true"
                onClick={() => setStatsMenuOpen((open) => !open)}
              >
                {t('nav.stats')}
                <ChevronIcon expanded={statsMenuOpen} />
              </button>
              {statsMenuOpen && (
                <div className="nav-dropdown-menu" role="menu">
                  <NavLink to="/stats" end role="menuitem">{t('nav.statsEvents')}</NavLink>
                  <NavLink to="/stats/program" role="menuitem">{t('nav.statsProgram')}</NavLink>
                </div>
              )}
            </div>
            <NavLink to="/about">{t('nav.about')}</NavLink>
          </nav>
          <div className="nav-right">
            <span className="muted small">{username}</span>
            <div className="nav-right-actions">
              <button className="btn" onClick={logout}>{t('nav.logout')}</button>
              <NavLink
                to="/settings"
                className="btn nav-settings-btn"
                aria-label={t('nav.settings')}
                title={t('nav.settings')}
              >
                <SettingsIcon />
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
