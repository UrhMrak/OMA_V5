import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EventsProvider } from './context/EventsContext';
import Dashboard from './routes/Dashboard';
import CalendarPage from './routes/Calendar';
import Library from './routes/Library';
import Stats from './routes/Stats';
import ProgramStats from './routes/ProgramStats';
import About from './routes/About';
import Settings from './routes/Settings';
import Login from './routes/Auth/Login';
import TopNav from './components/Layout/TopNav';
import Footer from './components/Layout/Footer';
import PageTransition from './components/Layout/PageTransition';
import { useTextSize } from './context/TextSizeContext';

function Layout() {
  const { textSize } = useTextSize();

  return (
    <div className="app-shell">
      <TopNav />
      <main className="container" data-text-size={textSize}>
        <PageTransition>
          {(location) => (
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/library" element={<Library />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/stats/program" element={<ProgramStats />} />
              <Route path="/about" element={<About />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          )}
        </PageTransition>
      </main>
      <Footer />
    </div>
  );
}

function ProtectedApp() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <AuthProvider>
      <EventsProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </EventsProvider>
    </AuthProvider>
  );
}


