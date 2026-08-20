import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ProgramRow } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useEvents } from '../context/EventsContext';
import { useLanguage } from '../context/LanguageContext';
import { usePageReady } from '../components/Layout/PageTransition';
import Skeleton from '../components/Layout/Skeleton';
import ProgramTable from '../components/Program/ProgramTable';
import {
  findProgramForProject,
  PROGRAM_COLUMNS,
  propagateProgramToProject,
  searchAllPrograms,
} from '../lib/program';
import {
  PROJECT_QUERY_PARAM,
  buildProjectOptions,
  findDefaultProjectId,
  formatProjectLabel,
} from '../lib/projectOptions';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const loadedProjectIdRef = useRef<string | null>(null);

  const isAdmin = role === 'admin';
  const projectOptions = useMemo(() => buildProjectOptions(events), [events]);
  const trimmedSearchQuery = searchQuery.trim();
  const searchHits = useMemo(
    () => searchAllPrograms(events, projectOptions, trimmedSearchQuery),
    [events, projectOptions, trimmedSearchQuery]
  );
  const isSearching = trimmedSearchQuery.length > 0;

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

  function openSearchResult(projectId: string) {
    setSearchQuery('');
    selectProject(projectId);
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

      <input
        className="input program-search"
        type="search"
        placeholder={t('programPage.search')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {isSearching ? (
        <div className="program-search-results">
          {searchHits.length === 0 ? (
            <p className="muted">{t('programPage.searchNoResults')}</p>
          ) : (
            <div className="program-table-wrap">
              <table className="program-table program-search-table">
                <thead>
                  <tr>
                    <th className="program-col-project" scope="col">{t('programPage.searchProject')}</th>
                    <th className="program-col-no" scope="col">{t('program.no')}</th>
                    {PROGRAM_COLUMNS.map((column) => (
                      <th key={column} className={`program-col-${column}`} scope="col">
                        {t(`program.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {searchHits.map((hit) => {
                    const projectLabel = formatProjectLabel(hit.projectId, hit.projectTitle);
                    return (
                      <tr
                        key={`${hit.projectId}-${hit.row.id}-${hit.rowNumber}`}
                        className="program-search-hit"
                        tabIndex={0}
                        role="button"
                        aria-label={t('programPage.searchOpenProject', { project: projectLabel })}
                        onClick={() => openSearchResult(hit.projectId)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openSearchResult(hit.projectId);
                          }
                        }}
                      >
                        <td className="program-col-project">{projectLabel}</td>
                        <td className="program-col-no">{hit.rowNumber}</td>
                        {PROGRAM_COLUMNS.map((column) => (
                          <td key={column} className={`program-col-${column}`}>
                            <span className="program-readonly-value">{hit.row[column]}</span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : projectOptions.length === 0 ? (
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
                    {formatProjectLabel(option.projectId, option.title)}
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
