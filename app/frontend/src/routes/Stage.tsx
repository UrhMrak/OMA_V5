import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { SeatingChart as SeatingChartData } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useEvents } from '../context/EventsContext';
import { useLanguage } from '../context/LanguageContext';
import { usePageReady } from '../components/Layout/PageTransition';
import Skeleton from '../components/Layout/Skeleton';
import SeatingChart from '../components/Stage/SeatingChart';
import StagePdfPanel from '../components/Stage/StagePdfPanel';
import WaitingMessage from '../components/WaitingMessage';
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
  createWeek34MenningarnottSeatingChart,
  createWeek34SeatingChart,
  createWeek35SeatingChart,
  cloneSeatingChart,
  emptySeatingChart,
  findConductorForProject,
  findSeatingForProject,
  findStagePdfForProject,
  isWeek34HljodritunProject,
  isWeek34MenningarnottProject,
  isWeek35KlassikinProject,
  propagateSeatingToProject,
  propagateStagePdfToProject,
  resolveSeatingForProject,
  seatingHasNamedPlayers,
  withDefaultInstruments,
} from '../lib/seating';
import { downloadSeatingPdf } from '../lib/seatingPdf';
import { api } from '../lib/api';

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
  const [addInstrumentKey, setAddInstrumentKey] = useState('');
  const [copyFromProjectId, setCopyFromProjectId] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const loadedProjectIdRef = useRef<string | null>(null);
  const seededProjectsRef = useRef<Set<string>>(new Set());
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = role === 'admin';
  const projectOptions = useMemo(() => buildProjectOptions(events), [events]);
  const conductor = selectedProjectId ? findConductorForProject(events, selectedProjectId) : '';
  const stagePdfPath = selectedProjectId ? findStagePdfForProject(events, selectedProjectId) : '';
  const visibleForMusician = isAdmin || seatingHasNamedPlayers(chart);

  const availableInstruments = INSTRUMENT_CATALOG.filter(
    (entry) => !chart.sections.some((section) => section.instrument === entry.key)
  );
  const copySourceOptions = useMemo(() => {
    const selected = projectOptions.find((option) => option.projectId === selectedProjectId);
    return projectOptions.filter((option) => {
      if (option.projectId === selectedProjectId) return false;
      if (selected && option.latestDateISO >= selected.earliestDateISO) return false;
      return seatingHasNamedPlayers(resolveSeatingForProject(events, option.projectId, option));
    });
  }, [projectOptions, selectedProjectId, events]);

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
    setCopyFromProjectId('');
    setCustomLabel('');
  }, [loaded, selectedProjectId, events, projectOptions, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !loaded || projectOptions.length === 0) return;

    const seedTargets = [
      { match: isWeek35KlassikinProject, create: createWeek35SeatingChart },
      { match: isWeek34MenningarnottProject, create: createWeek34MenningarnottSeatingChart },
      { match: isWeek34HljodritunProject, create: createWeek34SeatingChart },
    ] as const;

    for (const target of seedTargets) {
      const option = projectOptions.find(target.match);
      if (!option || seededProjectsRef.current.has(option.projectId)) continue;
      if (seatingHasNamedPlayers(findSeatingForProject(events, option.projectId))) {
        seededProjectsRef.current.add(option.projectId);
        continue;
      }
      seededProjectsRef.current.add(option.projectId);
      void (async () => {
        try {
          await propagateSeatingToProject(events, option.projectId, target.create());
          await loadEvents();
        } catch (seedError) {
          console.error('Seed seating failed:', seedError);
          seededProjectsRef.current.delete(option.projectId);
        }
      })();
    }
  }, [isAdmin, loaded, events, projectOptions, loadEvents]);

  function selectProject(projectId: string) {
    loadedProjectIdRef.current = null;
    setSelectedProjectId(projectId);
    setSearchParams(projectId ? { [PROJECT_QUERY_PARAM]: projectId } : {}, { replace: true });
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

  function enterDataFrom() {
    if (!copyFromProjectId || copyFromProjectId === selectedProjectId) return;
    const option = projectOptions.find((entry) => entry.projectId === copyFromProjectId);
    const source = resolveSeatingForProject(events, copyFromProjectId, option);
    if (!seatingHasNamedPlayers(source)) {
      setError(t('stagePage.copyFromEmpty'));
      setSavedMessage('');
      return;
    }

    setChart(withDefaultInstruments(cloneSeatingChart(source)));
    setCopyFromProjectId('');
    setError('');
    setSavedMessage(
      t('stagePage.copiedFrom', {
        project: formatProjectLabel(copyFromProjectId, option?.title || ''),
      })
    );
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

  function exportPdf() {
    const option = projectOptions.find((entry) => entry.projectId === selectedProjectId);
    try {
      downloadSeatingPdf({
        projectTitle: (option?.title || '').trim(),
        conductor,
        chart,
        t,
      });
    } catch (exportError) {
      console.error('Export seating PDF failed:', exportError);
      setError(t('stagePage.exportPdfFailed'));
    }
  }

  async function uploadStagePdf(file: File) {
    if (!selectedProjectId || isUploadingPdf) return;
    if (file.type !== 'application/pdf') {
      setError(t('stagePage.pdfInvalidType'));
      return;
    }

    setIsUploadingPdf(true);
    setError('');
    setSavedMessage('');
    try {
      const form = new FormData();
      form.append('folder', `stage/${selectedProjectId}`);
      form.append('files', file);
      const result = await api.upload<{ files?: Array<{ path: string }> }>('/api/library/upload', form);
      const path = result.files?.[0]?.path?.trim();
      if (!path) throw new Error(t('stagePage.pdfUploadFailed'));

      await propagateStagePdfToProject(events, selectedProjectId, path);
      await loadEvents();
      setSavedMessage(t('stagePage.pdfUploaded'));
    } catch (uploadError) {
      console.error('Upload stage PDF failed:', uploadError);
      setError(
        uploadError instanceof Error && uploadError.message
          ? uploadError.message
          : t('stagePage.pdfUploadFailed')
      );
    } finally {
      setIsUploadingPdf(false);
    }
  }

  async function removeStagePdf() {
    if (!selectedProjectId || isUploadingPdf || !stagePdfPath) return;
    setIsUploadingPdf(true);
    setError('');
    setSavedMessage('');
    try {
      await propagateStagePdfToProject(events, selectedProjectId, '');
      await loadEvents();
      setSavedMessage(t('stagePage.pdfRemoved'));
    } catch (removeError) {
      console.error('Remove stage PDF failed:', removeError);
      setError(
        removeError instanceof Error && removeError.message
          ? removeError.message
          : t('stagePage.pdfRemoveFailed')
      );
    } finally {
      setIsUploadingPdf(false);
    }
  }

  function handlePdfInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void uploadStagePdf(file);
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

      {projectOptions.length === 0 ? (
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
            <div className="program-page-actions">
              <button
                type="button"
                className="btn"
                onClick={exportPdf}
                disabled={!seatingHasNamedPlayers(chart)}
              >
                {t('stagePage.exportPdf')}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => void saveSeating()}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <WaitingMessage as="span" live="off">
                      {t('stagePage.saving')}
                    </WaitingMessage>
                  ) : (
                    t('stagePage.save')
                  )}
                </button>
              )}
            </div>
          </div>

          {isAdmin && <p className="muted small">{t('stagePage.sharedHint')}</p>}

          {isAdmin && (
            <div className="stage-add-instrument">
              <select
                className="input"
                value={copyFromProjectId}
                onChange={(e) => setCopyFromProjectId(e.target.value)}
                aria-label={t('stagePage.enterDataFrom')}
                disabled={copySourceOptions.length === 0}
              >
                <option value="">{t('stagePage.selectPastProject')}</option>
                {copySourceOptions.map((option) => (
                  <option key={option.projectId} value={option.projectId}>
                    {formatProjectLabel(option.projectId, option.title)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn"
                onClick={enterDataFrom}
                disabled={!copyFromProjectId}
              >
                {t('stagePage.enterDataFrom')}
              </button>
            </div>
          )}

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

          {isAdmin && (
            <div className="stage-pdf-admin">
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={handlePdfInputChange}
              />
              <button
                type="button"
                className="btn"
                onClick={() => pdfInputRef.current?.click()}
                disabled={isUploadingPdf}
              >
                {isUploadingPdf ? (
                  <WaitingMessage as="span" live="off">
                    {t('stagePage.pdfUploading')}
                  </WaitingMessage>
                ) : (
                  t('stagePage.uploadPdf')
                )}
              </button>
              {stagePdfPath && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void removeStagePdf()}
                  disabled={isUploadingPdf}
                >
                  {t('stagePage.removePdf')}
                </button>
              )}
              <p className="muted small">{t('stagePage.pdfAdminHint')}</p>
            </div>
          )}

          {stagePdfPath && <StagePdfPanel path={stagePdfPath} />}

          {error && <p className="error">{error}</p>}
          {savedMessage && <p className="muted small">{savedMessage}</p>}
        </>
      )}
    </div>
  );
}
