import { createContext, useContext, useEffect, useState } from 'react';
import {
  Language,
  Translations,
  translations,
  translate,
  LOCALES,
} from '../lib/i18n';

type TranslateParams = Record<string, string | number>;

type Ctx = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, params?: TranslateParams) => string;
  dict: Translations;
  locale: string | undefined;
};

const STORAGE_KEY = 'oma:language';

const LanguageContext = createContext<Ctx>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => key,
  dict: translations.en,
  locale: LOCALES.en,
});

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'is' || stored === 'en' ? stored : 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Ignore storage failures; preference still applies for this session.
    }
  }, [language]);

  function setLanguage(next: Language) {
    setLanguageState(next);
  }

  function toggleLanguage() {
    setLanguageState((current) => (current === 'en' ? 'is' : 'en'));
  }

  const t = (key: string, params?: TranslateParams) => translate(language, key, params);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        dict: translations[language],
        locale: LOCALES[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
