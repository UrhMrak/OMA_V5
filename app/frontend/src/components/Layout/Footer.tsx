import { Link, NavLink } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-col footer-brand-col">
          <Link to="/" className="footer-brand">Orchestra Manager</Link>
          <p className="footer-tagline muted small">
            {t('footer.tagline')}
          </p>
        </div>

        <div className="footer-col">
          <h4 className="footer-heading">{t('footer.navigate')}</h4>
          <nav className="footer-nav">
            <NavLink to="/" end>{t('nav.home')}</NavLink>
            <NavLink to="/calendar">{t('nav.calendar')}</NavLink>
            <NavLink to="/library">{t('nav.library')}</NavLink>
            <NavLink to="/stage">{t('nav.stage')}</NavLink>
            <NavLink to="/stats" end>{t('nav.statsEvents')}</NavLink>
            <NavLink to="/stats/program">{t('nav.statsProgram')}</NavLink>
            <NavLink to="/about">{t('nav.about')}</NavLink>
          </nav>
        </div>

        <div className="footer-col">
          <h4 className="footer-heading">{t('footer.resources')}</h4>
          <nav className="footer-nav">
            <Link to="/about#help">{t('footer.help')}</Link>
            <Link to="/about#privacy">{t('footer.privacy')}</Link>
            <Link to="/about#terms">{t('footer.terms')}</Link>
          </nav>
        </div>

        <div className="footer-col">
          <h4 className="footer-heading">{t('footer.contact')}</h4>
          <nav className="footer-nav">
            <a href="mailto:mrak.webstudios@gmail.com">mrak.webstudios@gmail.com</a>
          </nav>
        </div>
      </div>

      <div className="footer-bottom">
        <span className="muted small">
          {t('footer.rights', { year })}
        </span>
      </div>
    </footer>
  );
}
