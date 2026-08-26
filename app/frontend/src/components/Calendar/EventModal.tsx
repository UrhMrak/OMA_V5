import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { EventItem, ProgramRow } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { useEvents } from '../../context/EventsContext';
import { useCatalog } from '../../context/CatalogContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../lib/api';
import {
  buildEventFieldSuggestions,
  isSuggestibleEventField,
  type SuggestibleEventField,
} from '../../lib/eventSuggestions';
import {
  isoToInputValue,
  inputValueToISO,
  defaultNewEventRangeISO,
  formatWallTime,
  formatEventHeadingDateTime,
} from '../../lib/date';
import { downloadICS } from '../../lib/ics';
import {
  buildCreateFormFromProjectId,
  computeAutoProjectId,
  findEventByProjectId,
  getWeekKeyFromISO,
  syncProjectIdsForWeeks,
} from '../../lib/projectId';
import {
  findProgramForProject,
  getProgramRows,
  programRowsToText,
  propagateProgramToProject,
} from '../../lib/program';
import DeleteIcon from '../icons/DeleteIcon';
import WaitingMessage from '../WaitingMessage';
import { useModalClose } from '../Layout/useModalClose';
import AutoResizeTextarea from '../AutoResizeTextarea';
import SuggestTextarea from '../SuggestTextarea';
import ProgramTable from '../Program/ProgramTable';
import { PROJECT_QUERY_PARAM } from '../../lib/projectOptions';

const DEFAULT_EVENT_DURATION_MS = 3 * 60 * 60 * 1000;
const FALLBACK_EVENT_COLOR = '#0D77D4';
const LAST_EVENT_COLOR_KEY = 'oma:lastEventColor';

function getLastUsedColor(): string {
  if (typeof window === 'undefined') return FALLBACK_EVENT_COLOR;
  try {
    return window.localStorage.getItem(LAST_EVENT_COLOR_KEY) || FALLBACK_EVENT_COLOR;
  } catch {
    return FALLBACK_EVENT_COLOR;
  }
}

function rememberLastUsedColor(color?: string): void {
  if (typeof window === 'undefined' || !color) return;
  try {
    window.localStorage.setItem(LAST_EVENT_COLOR_KEY, color);
  } catch {
    // Ignore storage failures (e.g. private mode) and keep default behavior.
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = (hex || '').trim().replace('#', '');
  if (normalized.length !== 3 && normalized.length !== 6) {
    return `rgba(37, 99, 235, ${alpha})`;
  }
  const full =
    normalized.length === 3
      ? normalized.split('').map((c) => c + c).join('')
      : normalized;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeForm(source?: Partial<EventItem>): Partial<EventItem> {
  const defaultRange = defaultNewEventRangeISO();
  const defaults: Partial<EventItem> = {
    color: getLastUsedColor(),
    title: '',
    program: '',
    conductor: '',
    soloists: '',
    otherParticipants: '',
    ensemble: '',
    activity: '',
    venue: '',
    dress: '',
    other: '',
    libraryPath: '',
    projectId: '',
    projectIdOverridden: false,
    dateISO: defaultRange.dateISO,
    endDateISO: defaultRange.endDateISO,
  };

  const merged = { ...defaults, ...source };
  const startMsCandidate = merged.dateISO ? Date.parse(merged.dateISO) : Date.parse(defaultRange.dateISO);
  const startMs = Number.isNaN(startMsCandidate) ? Date.parse(defaultRange.dateISO) : startMsCandidate;
  const endMsCandidate = merged.endDateISO ? Date.parse(merged.endDateISO) : NaN;
  const startDatePart = isoToInputValue(new Date(startMs).toISOString()).slice(0, 10);
  const defaultEndISO =
    (startDatePart ? inputValueToISO(`${startDatePart}T13:00`) : '') || defaultRange.endDateISO;
  const endMs = Number.isNaN(endMsCandidate)
    ? Date.parse(defaultEndISO)
    : endMsCandidate;

  return {
    ...merged,
    dateISO: new Date(startMs).toISOString(),
    endDateISO: new Date(endMs).toISOString(),
  };
}

export default function EventModal({
  event, 
  draft,
  onClose, 
  onSave,
  onCopy
}: { 
  event: EventItem | null; 
  draft?: Partial<EventItem>;
  onClose: () => void;
  onSave?: () => void;
  onCopy?: (event: EventItem) => void;
}) {
  const { role } = useAuth();
  const { events, loadEvents } = useEvents();
  const { works: catalogWorks } = useCatalog();
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const isAdmin = role === 'admin';
  const isCreating = event === null;
  const closeOnlyViaButton = isAdmin && !isCreating;
  const fieldSuggestions = useMemo(() => buildEventFieldSuggestions(events), [events]);

  const [form, setForm] = useState<Partial<EventItem>>(() => normalizeForm(event ?? draft));
  const [programRows, setProgramRows] = useState<ProgramRow[]>(() => getProgramRows(event ?? draft));
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const lastPrefilledProjectIdRef = useRef<string | null>(null);
  const loadedProgramProjectIdRef = useRef<string | null>(null);
  const { closing, requestClose } = useModalClose(onClose);

  useEffect(() => {
    if (event) {
      setForm(normalizeForm(event));
    } else {
      setForm(normalizeForm(draft));
    }
    setProgramRows(getProgramRows(event ?? draft));
    lastPrefilledProjectIdRef.current = null;
    loadedProgramProjectIdRef.current = null;
  }, [event, draft]);

  const displayedProjectId = useMemo(() => {
    if (form.projectIdOverridden) return form.projectId || '';
    return computeAutoProjectId(form, events, {
      eventId: isCreating ? '__draft__' : event?.id,
      includeDraft: isCreating || !!event?.id,
    });
  }, [form, events, isCreating, event?.id]);

  // The program belongs to the project, so switching project pulls in its rows.
  useEffect(() => {
    const projectId = displayedProjectId.trim();
    if (!projectId || loadedProgramProjectIdRef.current === projectId) return;
    loadedProgramProjectIdRef.current = projectId;
    const projectRows = findProgramForProject(events, projectId);
    if (projectRows.length > 0) setProgramRows(projectRows);
  }, [displayedProjectId, events]);

  async function syncAffectedWeeks(previousDateISO?: string, nextDateISO?: string) {
    const weekKeys = [
      ...new Set(
        [previousDateISO, nextDateISO]
          .map((dateISO) => (dateISO ? getWeekKeyFromISO(dateISO) : ''))
          .filter(Boolean)
      ),
    ];
    if (weekKeys.length === 0) return null;
    const freshEvents = await api.get<EventItem[]>('/api/events');
    await syncProjectIdsForWeeks(freshEvents, weekKeys);
    return loadEvents();
  }

  /**
   * Runs after the project ID sync so the fan-out targets the project the saved
   * event actually ended up in, not the one predicted before re-indexing.
   */
  async function shareProgramWithProject(
    syncedEvents: EventItem[] | null,
    savedEventId: string,
    fallbackProjectId: string
  ) {
    const latestEvents = syncedEvents ?? events;
    const savedEvent = savedEventId
      ? latestEvents.find((item) => item.id === savedEventId)
      : undefined;
    const projectId = (savedEvent?.projectId || fallbackProjectId || '').trim();
    if (!projectId) return;

    await propagateProgramToProject(latestEvents, projectId, programRows, savedEventId);
    await loadEvents();
  }

  async function save() {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const projectId = form.projectIdOverridden
        ? form.projectId || ''
        : computeAutoProjectId(form, events, {
            eventId: isCreating ? '__draft__' : event?.id,
            includeDraft: isCreating || !!event?.id,
          });
      const payload = {
        ...form,
        projectId,
        projectIdOverridden: !!form.projectIdOverridden,
        programRows,
        program: programRowsToText(programRows),
      };
      rememberLastUsedColor(form.color);
      const previousDateISO = event?.dateISO;
      let savedEventId = event?.id || '';
      if (isCreating) {
        const created = await api.post<EventItem>('/api/events', payload);
        savedEventId = created?.id || '';
      } else if (event) {
        await api.put(`/api/events/${event.id}`, payload);
      }
      const syncedEvents = await syncAffectedWeeks(previousDateISO, form.dateISO);
      await shareProgramWithProject(syncedEvents, savedEventId, projectId);
      if (onSave) {
        await Promise.resolve(onSave());
      }
      requestClose();
    } catch (error) {
      console.error('Save event failed:', error);
      const message = error instanceof Error && error.message ? error.message : t('event.saveFailed');
      alert(message);
    } finally {
      setIsSaving(false);
    }
  }

  function renderEditableTextarea(
    value: string,
    onValueChange: (nextValue: string) => void,
    field: SuggestibleEventField,
    style?: CSSProperties
  ) {
    if (isAdmin) {
      return (
        <SuggestTextarea
          className="textarea"
          value={value}
          style={style}
          suggestions={fieldSuggestions[field]}
          onChange={(e) => onValueChange(e.target.value)}
        />
      );
    }

    return (
      <AutoResizeTextarea
        className="textarea"
        value={value}
        style={style}
        onChange={(e) => onValueChange(e.target.value)}
      />
    );
  }

  async function handleDelete() {
    if (!event) return;
    const confirmed = window.confirm(t('event.deleteConfirm', { title: event.title || t('event.thisEvent') }));
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      const weekKey = getWeekKeyFromISO(event.dateISO);
      await api.delete(`/api/events/${event.id}`);
      if (weekKey) {
        const freshEvents = await api.get<EventItem[]>('/api/events');
        await syncProjectIdsForWeeks(freshEvents, [weekKey]);
        await loadEvents();
      }
      if (onSave) {
        onSave();
      }
      requestClose();
    } catch (error) {
      console.error('Delete event failed:', error);
      const message = error instanceof Error && error.message ? error.message : t('event.deleteFailed');
      alert(message);
      setIsDeleting(false);
    }
  }

  function row(label: string, key: keyof EventItem, type: 'text' | 'color' | 'datetime-local' = 'text', tight = false, detailField = false) {
    const value = (form[key] as string) || '';
    const readOnly = role !== 'admin';
    if (readOnly && !value) return null;
    const inputStyle = readOnly ? { border: 'none', background: 'transparent' } : {};
    const rowClass = [tight ? 'row-gap tight' : 'row-gap', detailField ? 'event-detail-field' : '']
      .filter(Boolean)
      .join(' ');
    
    if (type === 'color') {
      if (readOnly) {
        return (
          <div className="row-gap">
            <label className="label">{label}</label>
            <span 
              className="event-color" 
              style={{ background: String(value), width: 20, height: 20 }}
            />
          </div>
        );
      }
      return (
        <div className="row-gap">
          <label className="label">{label}</label>
          <div className="row" style={{ alignItems: 'center' }}>
            <input 
              className="input" 
              type="color" 
              value={String(value)} 
              disabled={readOnly} 
              onChange={(e) => setForm({ ...form, [key]: e.target.value })} 
              style={{ maxWidth: 80, padding: 0 }}
            />
            <span 
              className="event-color" 
              style={{ background: String(value), width: 20, height: 20 }}
            />
            <input
              className="input"
              type="text"
              value={String(value)}
              disabled={readOnly}
              spellCheck={false}
              maxLength={7}
              placeholder="#000000"
              onChange={(e) => {
                let next = e.target.value.trim();
                if (next && !next.startsWith('#')) next = `#${next}`;
                setForm({ ...form, [key]: next });
              }}
              style={{ marginLeft: 8, maxWidth: 100, fontFamily: 'monospace', textTransform: 'uppercase' }}
            />
          </div>
        </div>
      );
    }
    
    if (type === 'datetime-local') {
      const dateValue = isoToInputValue(value);
      return (
        <div className="row-gap">
          <label className="label">{label}</label>
          <input 
            className="input" 
            type="datetime-local" 
            value={dateValue} 
            disabled={readOnly} 
            style={inputStyle}
            onChange={(e) => {
              const iso = inputValueToISO(e.target.value);
              if (!iso) return;
              setForm({ ...form, [key]: iso });
            }} 
          />
        </div>
      );
    }
    
    return (
      <div className={rowClass}>
        <label className="label">{label}</label>
        {readOnly ? (
          <div className="event-readonly-value">{String(value)}</div>
        ) : isSuggestibleEventField(key) ? (
          renderEditableTextarea(String(value), (nextValue) => setForm({ ...form, [key]: nextValue }), key, inputStyle)
        ) : (
          <AutoResizeTextarea
            className="textarea"
            value={String(value)}
            style={inputStyle}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        )}
      </div>
    );
  }

  function handleProjectIdChange(nextProjectId: string) {
    setForm((prev) => {
      const nextForm: Partial<EventItem> = {
        ...prev,
        projectId: nextProjectId,
        projectIdOverridden: true,
      };

      const trimmedProjectId = nextProjectId.trim();
      if (!isCreating || !trimmedProjectId) {
        if (!trimmedProjectId) lastPrefilledProjectIdRef.current = null;
        return nextForm;
      }

      if (lastPrefilledProjectIdRef.current === trimmedProjectId) {
        return nextForm;
      }

      const sourceEvent = findEventByProjectId(events, trimmedProjectId);
      if (!sourceEvent) return nextForm;

      lastPrefilledProjectIdRef.current = trimmedProjectId;
      return normalizeForm(buildCreateFormFromProjectId(sourceEvent, nextForm));
    });
  }

  function colorAndProjectIdRow() {
    const colorValue = form.color || FALLBACK_EVENT_COLOR;

    return (
      <div className="row-gap event-color-project-row">
        <div className="event-color-project-fields">
          <div className="event-color-field">
            <label className="label">{t('event.color')}</label>
            <div className="row" style={{ alignItems: 'center' }}>
              <input
                className="input"
                type="color"
                value={String(colorValue)}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                style={{ maxWidth: 80, padding: 0 }}
              />
              <span
                className="event-color"
                style={{ background: String(colorValue), width: 20, height: 20 }}
              />
              <input
                className="input"
                type="text"
                value={String(colorValue)}
                spellCheck={false}
                maxLength={7}
                placeholder="#000000"
                onChange={(e) => {
                  let next = e.target.value.trim();
                  if (next && !next.startsWith('#')) next = `#${next}`;
                  setForm({ ...form, color: next });
                }}
                style={{ marginLeft: 8, maxWidth: 100, fontFamily: 'monospace', textTransform: 'uppercase' }}
              />
            </div>
          </div>
          <div className="event-project-id-field">
            <label className="label">{t('event.projectId')}</label>
            <input
              className="input"
              type="text"
              value={displayedProjectId}
              spellCheck={false}
              placeholder="26-34-1"
              onChange={(e) => handleProjectIdChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    );
  }

  function eventHeadingDateTime() {
    const text = formatEventHeadingDateTime(form.dateISO, form.endDateISO, locale, {
      includeWeekday: true,
    });
    if (!text) return null;
    return <div className="event-heading-datetime">{text}</div>;
  }

  function dateRangeRow() {
    const startValue = form.dateISO || '';
    const endValue = form.endDateISO || '';
    const readOnly = role !== 'admin';
    const inputStyle = readOnly ? { border: 'none', background: 'transparent' } : {};
    const startDateValue = isoToInputValue(startValue);
    const endTimeValue = formatWallTime(endValue);

    return (
      <div className="row-gap">
        <label className="label">{t('event.dateTime')}</label>
        <div className="row date-range-row">
          <input
            className="input date-start"
            type="datetime-local"
            value={startDateValue}
            disabled={readOnly}
            style={inputStyle}
            onChange={(e) => {
              const nextStartIso = inputValueToISO(e.target.value);
              if (!nextStartIso) return;
              const startMs = Date.parse(nextStartIso);
              setForm((prev) => {
                const prevStartMs = prev.dateISO ? Date.parse(prev.dateISO) : NaN;
                const prevEndMs = prev.endDateISO ? Date.parse(prev.endDateISO) : NaN;
                const durationMs =
                  !Number.isNaN(prevStartMs) &&
                  !Number.isNaN(prevEndMs) &&
                  prevEndMs >= prevStartMs
                    ? prevEndMs - prevStartMs
                    : DEFAULT_EVENT_DURATION_MS;

                return {
                  ...prev,
                  dateISO: nextStartIso,
                  endDateISO: new Date(startMs + durationMs).toISOString(),
                };
              });
            }}
          />
          <span className="date-range-sep" aria-hidden="true">-</span>
          <input
            className="input date-end"
            type="time"
            value={endTimeValue}
            disabled={readOnly}
            style={inputStyle}
            onChange={(e) => {
              const time = e.target.value;
              if (!time) return;
              const startDatePart = (isoToInputValue(form.dateISO) || '').slice(0, 10);
              if (!startDatePart) return;
              const iso = inputValueToISO(`${startDatePart}T${time}`);
              if (!iso) return;
              setForm((prev) => ({ ...prev, endDateISO: iso }));
            }}
          />
        </div>
      </div>
    );
  }

  function programRow() {
    const readOnly = role !== 'admin';
    if (readOnly && programRows.length === 0) return null;

    return (
      <div className="row-gap tight event-detail-field">
        <label className="label">{t('event.program')}</label>
        <ProgramTable
          rows={programRows}
          onChange={setProgramRows}
          readOnly={readOnly}
          catalog={isAdmin ? catalogWorks : undefined}
        />
      </div>
    );
  }

  function otherParticipantsRow() {
    const value = form.otherParticipants || '';
    const readOnly = role !== 'admin';
    const textareaStyle: CSSProperties = readOnly
      ? { border: 'none', background: 'transparent' }
      : {};

    if (readOnly && !value) return null;

    return (
      <div className="row-gap tight event-detail-field">
        <label className="label">{t('event.otherParticipants')}</label>
        {readOnly ? (
          <div className="event-readonly-value">{value}</div>
        ) : (
          renderEditableTextarea(
            value,
            (nextValue) => setForm({ ...form, otherParticipants: nextValue }),
            'otherParticipants',
            textareaStyle
          )
        )}
      </div>
    );
  }

  function otherRow() {
    const value = form.other || '';
    const readOnly = role !== 'admin';
    const textareaStyle: CSSProperties = readOnly
      ? { border: 'none', background: 'transparent' }
      : {};

    if (readOnly && !value) return null;

    return (
      <div className="row-gap tight event-detail-field">
        <label className="label">{t('event.other')}</label>
        {readOnly ? (
          <div className="event-readonly-value">{value}</div>
        ) : (
          renderEditableTextarea(value, (nextValue) => setForm({ ...form, other: nextValue }), 'other', textareaStyle)
        )}
      </div>
    );
  }

  const selectedColor = form.color || FALLBACK_EVENT_COLOR;
  const modalStyle: CSSProperties = {
    backgroundColor: 'var(--surface)',
    backgroundImage: `linear-gradient(to bottom, ${hexToRgba(selectedColor, 0.55)} 0%, ${hexToRgba(selectedColor, 0)} 200px)`,
  };

  return (
    <div
      className={`modal-backdrop ${closing ? 'closing' : ''}`}
      onClick={closeOnlyViaButton ? undefined : requestClose}
    >
      <div
        className={`modal ${closing ? 'closing' : ''}`}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {isAdmin ? (
          <h3 className="h3">{isCreating ? t('event.create') : t('event.details')}</h3>
        ) : (
          <div className="event-heading">
            <h3 className="h3 event-heading-title">{form.title || t('event.fallbackTitle')}</h3>
            {form.activity ? (
              <div className="event-heading-activity">{form.activity}</div>
            ) : null}
            {form.projectId ? (
              <div className="event-heading-project-id">{form.projectId}</div>
            ) : null}
            {eventHeadingDateTime()}
          </div>
        )}
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {isAdmin && dateRangeRow()}
            {isAdmin && colorAndProjectIdRow()}
            {isAdmin && <hr className="modal-divider" />}
            {isAdmin && row(t('event.title'), 'title', 'text', true)}
            {isAdmin && row(t('event.activity'), 'activity', 'text', true)}
            <div className={!isAdmin ? 'event-musician-details' : undefined}>
              {row(t('event.venue'), 'venue', 'text', true, true)}
              {programRow()}
              {row(t('event.conductor'), 'conductor', 'text', true, true)}
              {row(t('event.soloists'), 'soloists', 'text', true, true)}
              {otherParticipantsRow()}
              {row(t('event.ensemble'), 'ensemble', 'text', true, true)}
              {row(t('event.dress'), 'dress', 'text', true, true)}
              {otherRow()}
            </div>
          </div>
        </div>
        <div className="row-between event-modal-actions">
          {role === 'admin' && !isCreating ? (
            <button
              type="button"
              className={`${isDeleting ? 'btn btn-sm danger' : 'icon-button delete-button'}`}
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label={isDeleting ? t('event.deleting') : t('event.deleteEvent')}
              title={isDeleting ? t('event.deleting') : t('event.deleteEvent')}
            >
              {isDeleting ? (
                <WaitingMessage as="span" live="off">
                  {t('event.deleting')}
                </WaitingMessage>
              ) : (
                <DeleteIcon size={16} />
              )}
            </button>
          ) : (
            <div />
          )}
          <div className="event-modal-action-buttons">
            {!isCreating && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const projectId = displayedProjectId.trim();
                  navigate(
                    projectId
                      ? `/stage?${PROJECT_QUERY_PARAM}=${encodeURIComponent(projectId)}`
                      : '/stage'
                  );
                  requestClose();
                }}
              >
                {t('event.openStage')}
              </button>
            )}
            {!isAdmin && !isCreating && event && (
              <button className="btn" onClick={() => downloadICS(event)}>
                {t('event.addToCalendar')}
              </button>
            )}
            {role === 'admin' && !isCreating && event && onCopy && (
              <button
                className="btn"
                onClick={() => {
                  onCopy(event);
                  requestClose();
                }}
              >
                {t('event.copy')}
              </button>
            )}
            <button className="btn" onClick={requestClose}>{t('event.close')}</button>
            {role === 'admin' && (
              <button className="btn primary" onClick={() => void save()} disabled={isSaving}>
                {isCreating ? t('event.createBtn') : t('event.save')}
              </button>
            )}
          </div>
        </div>
        {isAdmin && isSaving ? (
          <WaitingMessage className="event-modal-saving waiting-message-accent">
            {t('event.saving')}
          </WaitingMessage>
        ) : null}
      </div>
    </div>
  );
}


