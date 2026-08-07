import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../lib/api';
import SettingsIcon from '../icons/SettingsIcon';

export default function TopNav() {
  const { username, clearSession } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

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
            <NavLink to="/stats">{t('nav.stats')}</NavLink>
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
