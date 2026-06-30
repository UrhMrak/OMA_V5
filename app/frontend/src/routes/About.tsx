import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const SUPPORT_EMAIL = 'mrak.webstudios@gmail.com';

export default function About() {
  const { hash } = useLocation();
  const { dict } = useLanguage();
  const about = dict.about;

  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <div className="row-gap">
      <div>
        <h2 className="h2">{about.title}</h2>
        <p className="muted">{about.intro}</p>
      </div>

      <section id="help" className="card">
        <h3 className="h3">{about.help.heading}</h3>
        <p className="muted small">{about.help.p1}</p>
        <p className="muted small">{about.help.p2}</p>
        <ul className="muted small">
          {about.help.items.map((item) => (
            <li key={item.label}>
              <strong>{item.label}</strong> {item.text}
            </li>
          ))}
        </ul>
        <p className="muted small">
          {about.help.contactPrefix}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          {about.help.contactSuffix}
        </p>
      </section>

      <section id="privacy" className="card">
        <h3 className="h3">{about.privacy.heading}</h3>
        <p className="muted small">{about.privacy.intro}</p>
        {about.privacy.sections.map((section) => (
          <p key={section.label} className="muted small">
            <strong>{section.label}</strong> {section.text}
          </p>
        ))}
        <p className="muted small">
          {about.privacy.contactPrefix}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          {about.privacy.contactSuffix}
        </p>
      </section>

      <section id="terms" className="card">
        <h3 className="h3">{about.terms.heading}</h3>
        <p className="muted small">{about.terms.intro}</p>
        {about.terms.sections.map((section) => (
          <p key={section.label} className="muted small">
            <strong>{section.label}</strong> {section.text}
          </p>
        ))}
      </section>
    </div>
  );
}
