import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.post<{ role: 'admin' | 'user'; token: string }>('/api/auth/login', { username, password });
      setSession({ username, role: res.role }, res.token);
      navigate('/');
    } catch (err: any) {
      setError(err?.message || t('login.failed'));
    }
  }

  return (
    <div className="auth-center">
      <div className="auth-content">
        <div
          className="calendar-view-toggle auth-lang-toggle"
          role="group"
          aria-label={t('settings.language')}
          style={{ alignSelf: 'flex-end' }}
        >
          <button
            type="button"
            className={language === 'en' ? 'active' : ''}
            aria-pressed={language === 'en'}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
          <button
            type="button"
            className={language === 'is' ? 'active' : ''}
            aria-pressed={language === 'is'}
            onClick={() => setLanguage('is')}
          >
            IS
          </button>
        </div>
        <img className="auth-logo" src={`${import.meta.env.BASE_URL}sitelogo.svg`} alt={t('login.logoAlt')} />
        <h1 className="auth-title">{t('login.appTitle')}</h1>
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1 className="h2">{t('login.signIn')}</h1>
        <label className="label">{t('login.username')}</label>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('login.usernamePlaceholder')} />
        <label className="label">{t('login.password')}</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        {error && <div className="error">{error}</div>}
        <button className="btn primary" type="submit">{t('login.signIn')}</button>
        <p className="muted small" style={{ marginTop: 8 }}>{t('login.devCreds')}</p>
      </form>
      </div>
    </div>
  );
}


