import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { SeatingChart as SeatingChartData } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useEvents } from '../context/EventsContext';
import { useLanguage } from '../context/LanguageContext';
import { usePageReady } from '../components/Layout/PageTransition';
import Skeleton from '../components/Layout/Skeleton';
import SeatingChart from '../components/Stage/SeatingChart';
import {
  PROJECT_QUERY_PARAM,
  buildProjectOptions,
  findDefaultProjectId,
  formatProjectLabel,
} from '../lib/projectOptions';
import {
  CUSTOM_INSTRUMENT,
  INSTRUMENT_CATALOG,
  createSeatingSection,
  createWeek35SeatingChart,
  emptySeatingChart,
  findConductorForProject,
  findSeatingForProject,
  getInstrumentLabelKey,
  isWeek35KlassikinProject,
  propagateSeatingToProject,
  resolveSeatingForProject,
  searchAllSeating,
  seatingHasNamedPlayers,
  withDefaultInstruments,
} from '../lib/seating';

export default function Stage() {
  const { events, loaded, loadEvents } = useEvents();
  const { role } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => searchParams.get(PROJECT_QUERY_PARAM) || ''
  );
  const [chart, setChart] = useState<SeatingChartData>(emptySeatingChart);
  const [searchQuery, setSearchQuery] = useState('');
  const [addInstrumentKey, setAddInstrumentKey] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const loadedProjectIdRef = useRef<string | null>(null);
  const seedPersistRef = useRef(false);

  const isAdmin = role === 'admin';
  const projectOptions = useMemo(() => buildProjectOptions(events), [events]);
  const trimmedSearchQuery = searchQuery.trim();
  const searchHits = useMemo(
    () => searchAllSeating(events, projectOptions, trimmedSearchQuery),
    [events, projectOptions, trimmedSearchQuery]
  );
  const isSearching = trimmedSearchQuery.length > 0;
  const conductor = selectedProjectId ? findConductorForProject(events, selectedProjectId) : '';
  const visibleForMusician = isAdmin || seatingHasNamedPlayers(chart);

  const availableInstruments = INSTRUMENT_CATALOG.filter(
    (entry) => !chart.sections.some((section) => section.instrument === entry.key)
  );

  useEffect(() => {
    if (location.pathname === '/stage') {
      loadEvents();
    }
  }, [location.pathname, loadEvents]);

  usePageReady(loaded);

  useEffect(() => {
    if (projectOptions.length === 0) return;
    if (projectOptions.some((option) => option.projectId === selectedProjectId)) return;
    setSelectedProjectId(findDefaultProjectId(projectOptions, new Date()));
  }, [projectOptions, selectedProjectId]);

  useEffect(() => {
    if (!loaded) return;
    if (loadedProjectIdRef.current === selectedProjectId) return;
    loadedProjectIdRef.current = selectedProjectId;
    const option = projectOptions.find((entry) => entry.projectId === selectedProjectId);
    const resolved = selectedProjectId
      ? resolveSeatingForProject(events, selectedProjectId, option)
      : emptySeatingChart();
    setChart(isAdmin ? withDefaultInstruments(resolved) : resolved);
    setError('');
    setSavedMessage('');
    setAddInstrumentKey('');
    setCustomLabel('');
  }, [loaded, selectedProjectId, events, projectOptions, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !loaded || seedPersistRef.current || projectOptions.length === 0) return;
    const option = projectOptions.find(isWeek35KlassikinProject);
    if (!option) return;
    if (seatingHasNamedPlayers(findSeatingForProject(events, option.projectId))) {
      seedPersistRef.current = true;
      return;
    }
    seedPersistRef.current = true;
    void (async () => {
      try {
        await propagateSeatingToProject(events, option.projectId, createWeek35SeatingChart());
        await loadEvents();
      } catch (seedError) {
        console.error('Seed week 35 seating failed:', seedError);
        seedPersistRef.current = false;
      }
    })();
  }, [isAdmin, loaded, events, projectOptions, loadEvents]);

  function selectProject(projectId: string) {
    loadedProjectIdRef.current = null;
    setSelectedProjectId(projectId);
    setSearchParams(projectId ? { [PROJECT_QUERY_PARAM]: projectId } : {}, { replace: true });
  }

  function openSearchResult(projectId: string) {
    setSearchQuery('');
    selectProject(projectId);
  }

  function sectionLabel(instrument: string, customLabelValue?: string): string {
    if (customLabelValue?.trim()) return customLabelValue.trim();
    return t(getInstrumentLabelKey(instrument));
  }

  function addInstrument() {
    if (!addInstrumentKey) return;
    if (addInstrumentKey === CUSTOM_INSTRUMENT && !customLabel.trim()) return;
    const alreadyPresent =
      addInstrumentKey !== CUSTOM_INSTRUMENT &&
      chart.sections.some((section) => section.instrument === addInstrumentKey);
    if (alreadyPresent) return;

    setChart({
      sections: [
        ...chart.sections,
        createSeatingSection(addInstrumentKey, {
          customLabel: addInstrumentKey === CUSTOM_INSTRUMENT ? customLabel.trim() : undefined,
        }),
      ],
    });
    setAddInstrumentKey('');
    setCustomLabel('');
  }

  async function saveSeating() {
    if (isSaving || !selectedProjectId) return;
    setIsSaving(true);
    setError('');
    setSavedMessage('');
    try {
      await propagateSeatingToProject(events, selectedProjectId, chart);
      loadedProjectIdRef.current = selectedProjectId;
      await loadEvents();
      setSavedMessage(t('stagePage.saved'));
    } catch (saveError) {
      console.error('Save seating failed:', saveError);
      setError(
        saveError instanceof Error && saveError.message
          ? saveError.message
          : t('stagePage.saveFailed')
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div>
        <h2 className="h2">{t('stagePage.title')}</h2>
        <div className="skeleton-table">
          {Array.from({ length: 4 }).map((_, rowIndex) => (
            <div key={rowIndex} className="skeleton-table-row">
              {Array.from({ length: 4 }).map((_, colIndex) => (
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
      <h2 className="h2">{t('stagePage.title')}</h2>

      <input
        className="input program-search"
        type="search"
        placeholder={t('stagePage.search')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {isSearching ? (
        <div className="program-search-results">
          {searchHits.length === 0 ? (
            <p className="muted">{t('stagePage.searchNoResults')}</p>
          ) : (
            <div className="program-table-wrap">
              <table className="program-table program-search-table">
                <thead>
                  <tr>
                    <th className="program-col-project" scope="col">{t('stagePage.searchProject')}</th>
                    <th scope="col">{t('stagePage.searchInstrument')}</th>
                    <th scope="col">{t('stagePage.searchPlayer')}</th>
                  </tr>
                </thead>
                <tbody>
                  {searchHits.map((hit) => {
                    const projectLabel = formatProjectLabel(hit.projectId, hit.projectTitle);
                    return (
                      <tr
                        key={`${hit.projectId}-${hit.playerId}`}
                        className="program-search-hit"
                        tabIndex={0}
                        role="button"
                        aria-label={t('stagePage.searchOpenProject', { project: projectLabel })}
                        onClick={() => openSearchResult(hit.projectId)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openSearchResult(hit.projectId);
                          }
                        }}
                      >
                        <td className="program-col-project">{projectLabel}</td>
                        <td>{sectionLabel(hit.instrument, hit.customLabel)}</td>
                        <td>
                          <span className="program-readonly-value">{hit.playerName}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : projectOptions.length === 0 ? (
        <p className="muted">{t('stagePage.noProjects')}</p>
      ) : (
        <>
          <div className="program-page-toolbar">
            <label className="program-project-picker">
              <span className="muted small">{t('stagePage.project')}</span>
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
                  onClick={() => void saveSeating()}
                  disabled={isSaving}
                >
                  {isSaving ? t('stagePage.saving') : t('stagePage.save')}
                </button>
              </div>
            )}
          </div>

          {isAdmin && <p className="muted small">{t('stagePage.sharedHint')}</p>}

          {isAdmin && (
            <div className="stage-add-instrument">
              <select
                className="input"
                value={addInstrumentKey}
                onChange={(e) => setAddInstrumentKey(e.target.value)}
                aria-label={t('stagePage.selectInstrument')}
              >
                <option value="">{t('stagePage.selectInstrument')}</option>
                {availableInstruments.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {t(`stage.instruments.${entry.key}`)}
                  </option>
                ))}
                <option value={CUSTOM_INSTRUMENT}>{t('stage.instruments.custom')}</option>
              </select>
              {addInstrumentKey === CUSTOM_INSTRUMENT && (
                <input
                  className="input"
                  type="text"
                  value={customLabel}
                  placeholder={t('stagePage.customInstrumentPlaceholder')}
                  onChange={(e) => setCustomLabel(e.target.value)}
                />
              )}
              <button
                type="button"
                className="btn"
                onClick={addInstrument}
                disabled={
                  !addInstrumentKey ||
                  (addInstrumentKey === CUSTOM_INSTRUMENT && !customLabel.trim())
                }
              >
                {t('stagePage.addInstrument')}
              </button>
            </div>
          )}

          {visibleForMusician ? (
            <SeatingChart
              chart={chart}
              conductor={conductor}
              readOnly={!isAdmin}
              onChange={isAdmin ? setChart : undefined}
            />
          ) : (
            <p className="muted">{t('stagePage.emptyChart')}</p>
          )}

          {error && <p className="error">{error}</p>}
          {savedMessage && <p className="muted small">{savedMessage}</p>}
        </>
      )}
    </div>
  );
}
