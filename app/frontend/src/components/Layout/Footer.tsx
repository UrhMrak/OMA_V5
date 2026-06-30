import { Link, NavLink } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-col footer-brand-col">
          <Link to="/" className="footer-brand">Orchestra Manager</Link>
          <p className="footer-tagline muted small">
            Plan rehearsals, manage your music library, and keep your ensemble in sync.
          </p>
        </div>

        <div className="footer-col">
          <h4 className="footer-heading">Navigate</h4>
          <nav className="footer-nav">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/calendar">Calendar</NavLink>
            <NavLink to="/library">Music Library</NavLink>
            <NavLink to="/stats">Stats</NavLink>
            <NavLink to="/about">About</NavLink>
          </nav>
        </div>

        <div className="footer-col">
          <h4 className="footer-heading">Resources</h4>
          <nav className="footer-nav">
            <Link to="/about#help">Help & Support</Link>
            <Link to="/about#privacy">Privacy Policy</Link>
            <Link to="/about#terms">Terms of Service</Link>
          </nav>
        </div>

        <div className="footer-col">
          <h4 className="footer-heading">Contact</h4>
          <nav className="footer-nav">
            <a href="mailto:mrak.webstudios@gmail.com">mrak.webstudios@gmail.com</a>
          </nav>
        </div>
      </div>

      <div className="footer-bottom">
        <span className="muted small">
          &copy; {year} Mrak Web Development. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
