import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { EventSizeProvider } from './context/EventSizeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AppPreferencesProvider } from './context/AppPreferencesContext';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <AppPreferencesProvider>
        <ThemeProvider>
          <EventSizeProvider>
            <HashRouter>
              <App />
            </HashRouter>
          </EventSizeProvider>
        </ThemeProvider>
      </AppPreferencesProvider>
    </LanguageProvider>
  </React.StrictMode>
);


