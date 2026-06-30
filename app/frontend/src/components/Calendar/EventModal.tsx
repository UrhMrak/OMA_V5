import { useState, useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { EventItem } from '../../lib/types';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { useNavigate } from 'react-router-dom';
import {
  getISOWeekNumber,
  getISOWeekYear,
  isoToInputValue,
  inputValueToISO,
  isoToWallDate,
  nowFloatingISO,
  formatWallTime,
} from '../../lib/date';
import { downloadICS } from '../../lib/ics';
import DeleteIcon from '../icons/DeleteIcon';
import { useModalClose } from '../Layout/useModalClose';

const DEFAULT_EVENT_DURATION_MS = 3 * 60 * 60 * 1000;
const FALLBACK_EVENT_COLOR = '#2563eb';
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
    dateISO: nowFloatingISO(),
  };

  const merged = { ...defaults, ...source };
  const startMsCandidate = merged.dateISO ? Date.parse(merged.dateISO) : Date.now();
  const startMs = Number.isNaN(startMsCandidate) ? Date.now() : startMsCandidate;
  const endMsCandidate = merged.endDateISO ? Date.parse(merged.endDateISO) : NaN;
  const endMs = Number.isNaN(endMsCandidate)
    ? startMs + DEFAULT_EVENT_DURATION_MS
    : endMsCandidate;

  return {
    ...merged,
    dateISO: new Date(startMs).toISOString(),
    endDateISO: new Date(endMs).toISOString(),
  };
}

export default function EventModal({ 
  event, 
  onClose, 
  onSave,
  onCopy
}: { 
  event: EventItem | null; 
  onClose: () => void;
  onSave?: () => void;
  onCopy?: (event: EventItem) => void;
}) {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const isCreating = event === null;
  const navigate = useNavigate();

  const [form, setForm] = useState<Partial<EventItem>>(() => normalizeForm(event ?? undefined));
  const [isDeleting, setIsDeleting] = useState(false);
  const { closing, requestClose } = useModalClose(onClose);

  useEffect(() => {
    if (event) {
      setForm(normalizeForm(event));
    } else {
      setForm(normalizeForm());
    }
  }, [event]);

  // Lock background scroll while modal is open
  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, []);

  const computedLibraryPath = useMemo(() => {
    if (!form.dateISO) return '';
    const date = isoToWallDate(form.dateISO);
    if (Number.isNaN(date.getTime())) return '';
    const isoWeek = getISOWeekNumber(date);
    const isoYear = getISOWeekYear(date);
    return `${isoYear}/week ${isoWeek}`;
  }, [form.dateISO]);

  useEffect(() => {
    setForm((prev) => {
      const current = prev.libraryPath || '';
      if (current === computedLibraryPath) {
        return prev;
      }
      return { ...prev, libraryPath: computedLibraryPath };
    });
  }, [computedLibraryPath]);

  const libraryPath = form.libraryPath || computedLibraryPath || '';

  async function save() {
    const payload = { ...form, libraryPath };
    rememberLastUsedColor(form.color);
    if (isCreating) {
      await api.post('/api/events', payload);
    } else if (event) {
      await api.put(`/api/events/${event.id}`, payload);
    }
    if (onSave) {
      await Promise.resolve(onSave());
    }
    requestClose();
  }

  async function handleDelete() {
    if (!event) return;
    const confirmed = window.confirm(`Delete "${event.title || 'this event'}"? This cannot be undone.`);
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/events/${event.id}`);
      if (onSave) {
        onSave();
      }
      requestClose();
    } catch (error) {
      console.error('Delete event failed:', error);
      const message = error instanceof Error && error.message ? error.message : 'Failed to delete event. Please try again.';
      alert(message);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleOpenLibrary(path: string) {
    if (!path) return;
    navigate('/library', { state: { targetLibraryPath: path } });
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
        <input 
          className="input" 
          value={String(value)} 
          readOnly={readOnly} 
          style={inputStyle}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })} 
        />
      </div>
    );
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
        <label className="label">Date & Time</label>
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
              const startDatePart = e.target.value.slice(0, 10);
              setForm((prev) => {
                const previousEndTime = formatWallTime(prev.endDateISO);
                let nextEndIso = prev.endDateISO;

                if (previousEndTime && startDatePart) {
                  nextEndIso = inputValueToISO(`${startDatePart}T${previousEndTime}`) || nextEndIso;
                } else {
                  nextEndIso = new Date(startMs + DEFAULT_EVENT_DURATION_MS).toISOString();
                }

                return {
                  ...prev,
                  dateISO: nextStartIso,
                  endDateISO: nextEndIso,
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

  function libraryFolderRow() {
    const hasPath = Boolean(libraryPath);
    return (
      <div className="row-gap">
        <label className="label">Music Library</label>
        <div className="row" style={{ alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn"
            disabled={!hasPath}
            onClick={() => handleOpenLibrary(libraryPath)}
          >
            Open Folder
          </button>
          <span className="small muted">{hasPath ? libraryPath : 'No folder detected'}</span>
        </div>
      </div>
    );
  }

  function programRow() {
    const value = form.program || '';
    const readOnly = role !== 'admin';
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const textareaStyle: CSSProperties = readOnly
      ? { border: 'none', background: 'transparent', overflow: 'hidden', resize: 'none' }
      : { overflow: 'hidden', resize: 'none' };

    useEffect(() => {
      if (textAreaRef.current) {
        textAreaRef.current.style.height = 'auto';
        textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px';
      }
    }, [value]);

    if (readOnly && !value) return null;

    return (
      <div className="row-gap tight event-detail-field">
        <label className="label">Program</label>
        <textarea 
          className="textarea" 
          ref={textAreaRef}
          value={value} 
          readOnly={readOnly} 
          rows={1}
          style={textareaStyle}
          onChange={(e) => setForm({ ...form, program: e.target.value })}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
          }} 
        />
      </div>
    );
  }

  function otherParticipantsRow() {
    const value = form.otherParticipants || '';
    const readOnly = role !== 'admin';
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const textareaStyle: CSSProperties = readOnly
      ? { border: 'none', background: 'transparent', overflow: 'hidden', resize: 'none' }
      : { overflow: 'hidden', resize: 'none' };

    useEffect(() => {
      if (textAreaRef.current) {
        textAreaRef.current.style.height = 'auto';
        textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px';
      }
    }, [value]);

    if (readOnly && !value) return null;

    return (
      <div className="row-gap tight event-detail-field">
        <label className="label">Other Participants</label>
        <textarea
          className="textarea"
          ref={textAreaRef}
          value={value}
          readOnly={readOnly}
          rows={1}
          style={textareaStyle}
          onChange={(e) => setForm({ ...form, otherParticipants: e.target.value })}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
          }}
        />
      </div>
    );
  }

  function otherRow() {
    const value = form.other || '';
    const readOnly = role !== 'admin';
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const textareaStyle: CSSProperties = readOnly
      ? { border: 'none', background: 'transparent', overflow: 'hidden', resize: 'none' }
      : { overflow: 'hidden', resize: 'none' };

    useEffect(() => {
      if (textAreaRef.current) {
        textAreaRef.current.style.height = 'auto';
        textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px';
      }
    }, [value]);

    if (readOnly && !value) return null;

    return (
      <div className="row-gap tight event-detail-field">
        <label className="label">Other</label>
        <textarea
          className="textarea"
          ref={textAreaRef}
          value={value}
          readOnly={readOnly}
          rows={1}
          style={textareaStyle}
          onChange={(e) => setForm({ ...form, other: e.target.value })}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
          }}
        />
      </div>
    );
  }

  const selectedColor = form.color || FALLBACK_EVENT_COLOR;
  const modalStyle: CSSProperties = {
    backgroundColor: 'var(--surface)',
    backgroundImage: `linear-gradient(to bottom, ${hexToRgba(selectedColor, 0.55)} 0%, ${hexToRgba(selectedColor, 0)} 200px)`,
  };

  return (
    <div className={`modal-backdrop ${closing ? 'closing' : ''}`} onClick={requestClose}>
      <div
        className={`modal ${closing ? 'closing' : ''}`}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {isAdmin ? (
          <h3 className="h3">{isCreating ? 'Create Event' : 'Event Details'}</h3>
        ) : (
          <div className="event-heading">
            <h3 className="h3 event-heading-title">{form.title || 'Event'}</h3>
            {form.activity ? (
              <div className="event-heading-activity">{form.activity}</div>
            ) : null}
          </div>
        )}
        <div className="modal-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {dateRangeRow()}
            {isAdmin && row('Color', 'color', 'color')}
            <hr className="modal-divider" />
            {isAdmin && row('Title', 'title', 'text', true)}
            {isAdmin && row('Activity', 'activity', 'text', true)}
            {row('Venue', 'venue', 'text', true, true)}
            {programRow()}
            {row('Conductor', 'conductor', 'text', true, true)}
            {row('Soloists', 'soloists', 'text', true, true)}
            {otherParticipantsRow()}
            {row('Ensemble', 'ensemble', 'text', true, true)}
            {row('Dress', 'dress', 'text', true, true)}
            {otherRow()}
            {libraryFolderRow()}
          </div>
        </div>
        <div className="row-between" style={{ marginTop: 16 }}>
          {role === 'admin' && !isCreating ? (
            <button
              type="button"
              className="icon-button delete-button"
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label="Delete event"
              title="Delete event"
            >
              <DeleteIcon size={16} />
            </button>
          ) : (
            <div />
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            {!isCreating && event && (
              <button className="btn" onClick={() => downloadICS(event)}>
                Add to Calendar
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
                Copy
              </button>
            )}
            <button className="btn" onClick={requestClose}>Close</button>
            {role === 'admin' && (
              <button className="btn primary" onClick={save}>
                {isCreating ? 'Create' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


