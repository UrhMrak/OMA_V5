import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { EventItem, ProgramRow } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useEvents } from '../context/EventsContext';
import { useLanguage } from '../context/LanguageContext';
import { usePageReady } from '../components/Layout/PageTransition';
import Skeleton from '../components/Layout/Skeleton';
import ProgramTable from '../components/Program/ProgramTable';
import { findProgramForProject, propagateProgramToProject } from '../lib/program';
import { WeekKey, getWeekKeyFromDate, getWeekKeyFromISO } from '../lib/projectId';
import {
  addDays,
  getLocalDateKey,
  getLocalDateKeyFromISO,
  getStartOfWeekMonday,
} from '../lib/date';

const PROJECT_QUERY_PARAM = 'project';

type ProjectOption = {
  projectId: string;
  title: string;
  earliestDateISO: string;
  latestDateISO: string;
  weekKeys: Set<WeekKey>;
};

function buildProjectOptions(events: EventItem[]): ProjectOption[] {
  const byProjectId = new Map<string, ProjectOption>();

  for (const event of events) {
    const projectId = (event.projectId || '').trim();
    if (!projectId) continue;

    const existing = byProjectId.get(projectId);
    if (!existing) {
      byProjectId.set(projectId, {
        projectId,
        title: event.title || '',
        earliestDateISO: event.dateISO,
        latestDateISO: event.dateISO,
        weekKeys: new Set([getWeekKeyFromISO(event.dateISO)]),
      });
      continue;
    }

    existing.weekKeys.add(getWeekKeyFromISO(event.dateISO));
    if (event.dateISO < existing.earliestDateISO) {
      existing.earliestDateISO = event.dateISO;
    }
    if (event.dateISO > existing.latestDateISO) {
      existing.latestDateISO = event.dateISO;
      existing.title = event.title || existing.title;
    }
  }

  return [...byProjectId.values()].sort((a, b) => b.latestDateISO.localeCompare(a.latestDateISO));
}

/** Opens on what the orchestra is playing this week, otherwise on the next project ahead. */
function findDefaultProjectId(options: ProjectOption[], now: Date): string {
  if (options.length === 0) return '';

  const currentWeekKey = getWeekKeyFromDate(now);
  const thisWeek = options.find((option) => option.weekKeys.has(currentWeekKey));
  if (thisWeek) return thisWeek.projectId;

  const nextWeekStartKey = getLocalDateKey(addDays(getStartOfWeekMonday(now), 7));
  const upcoming = options.filter(
    (option) => getLocalDateKeyFromISO(option.earliestDateISO) >= nextWeekStartKey
  );
  if (upcoming.length > 0) {
    return upcoming.reduce((soonest, option) =>
      option.earliestDateISO < soonest.earliestDateISO ? option : soonest
    ).projectId;
  }

  return options[0].projectId;
}

export default function ProgramStats() {
  const { events, loaded, loadEvents } = useEvents();
  const { role } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => searchParams.get(PROJECT_QUERY_PARAM) || ''
  );
  const [rows, setRows] = useState<ProgramRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const loadedProjectIdRef = useRef<string | null>(null);

  const isAdmin = role === 'admin';
  const projectOptions = useMemo(() => buildProjectOptions(events), [events]);

  useEffect(() => {
    if (location.pathname === '/stats/program') {
      loadEvents();
    }
  }, [location.pathname, loadEvents]);

  usePageReady(loaded);

  // Falls back to the default project once events arrive or a deep link goes stale.
  useEffect(() => {
    if (projectOptions.length === 0) return;
    if (projectOptions.some((option) => option.projectId === selectedProjectId)) return;
    setSelectedProjectId(findDefaultProjectId(projectOptions, new Date()));
  }, [projectOptions, selectedProjectId]);

  // Keyed on the project so a background refresh never discards unsaved edits.
  useEffect(() => {
    if (loadedProjectIdRef.current === selectedProjectId) return;
    loadedProjectIdRef.current = selectedProjectId;
    setRows(selectedProjectId ? findProgramForProject(events, selectedProjectId) : []);
    setError('');
    setSavedMessage('');
  }, [selectedProjectId, events]);

  function selectProject(projectId: string) {
    setSelectedProjectId(projectId);
    setSearchParams(projectId ? { [PROJECT_QUERY_PARAM]: projectId } : {}, { replace: true });
  }

  async function saveProgram() {
    if (isSaving || !selectedProjectId) return;
    setIsSaving(true);
    setError('');
    setSavedMessage('');
    try {
      await propagateProgramToProject(events, selectedProjectId, rows);
      await loadEvents();
      setSavedMessage(t('programPage.saved'));
    } catch (saveError) {
      console.error('Save program failed:', saveError);
      setError(
        saveError instanceof Error && saveError.message
          ? saveError.message
          : t('programPage.saveFailed')
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div>
        <h2 className="h2">{t('programPage.title')}</h2>
        <div className="skeleton-table">
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <div key={rowIndex} className="skeleton-table-row">
              {Array.from({ length: 5 }).map((_, colIndex) => (
                <Skeleton key={colIndex} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="h2">{t('programPage.title')}</h2>

      {projectOptions.length === 0 ? (
        <p className="muted">{t('programPage.noProjects')}</p>
      ) : (
        <>
          <div className="program-page-toolbar">
            <label className="program-project-picker">
              <span className="muted small">{t('programPage.project')}</span>
              <select
                className="input"
                value={selectedProjectId}
                onChange={(e) => selectProject(e.target.value)}
              >
                {projectOptions.map((option) => (
                  <option key={option.projectId} value={option.projectId}>
                    {option.title ? `${option.projectId} - ${option.title}` : option.projectId}
                  </option>
                ))}
              </select>
            </label>
            {isAdmin && (
              <div className="program-page-actions">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => void saveProgram()}
                  disabled={isSaving}
                >
                  {isSaving ? t('programPage.saving') : t('programPage.save')}
                </button>
              </div>
            )}
          </div>

          {isAdmin && <p className="muted small">{t('programPage.sharedHint')}</p>}

          <ProgramTable rows={rows} onChange={isAdmin ? setRows : undefined} readOnly={!isAdmin} />

          {!isAdmin && rows.length === 0 && <p className="muted">{t('programPage.emptyProgram')}</p>}
          {error && <p className="error">{error}</p>}
          {savedMessage && <p className="muted small">{savedMessage}</p>}
        </>
      )}
    </div>
  );
}
