import { useEffect, useMemo, useState, Fragment } from 'react';
import { EventItem } from '../lib/types';
import { api } from '../lib/api';
import EventModal from '../components/Calendar/EventModal';
import { useAuth } from '../context/AuthContext';
import { usePageReady } from '../components/Layout/PageTransition';
import {
  getLocalDateKey,
  getLocalDateKeyFromISO,
  getISOWeekNumber,
  getISOWeekYear,
  addDays,
  getStartOfWeekMonday,
  formatWallTime,
  isoToWallDate,
  inputValueToISO,
} from '../lib/date';

type ViewMode = 'month' | 'week';
type Direction = 'left' | 'right';
type CalendarRow = { weekNumber: number; cells: Array<Date | null> };

const DEFAULT_EVENT_DURATION_MS = 3 * 60 * 60 * 1000;
const COPIED_EVENT_KEY = 'oma:copiedEvent';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function buildPastePayload(source: EventItem, targetDay: Date): Partial<EventItem> {
  const wallStart = isoToWallDate(source.dateISO);
  const startMs = Date.parse(source.dateISO);
  const endMs = source.endDateISO ? Date.parse(source.endDateISO) : NaN;
  const durationMs =
    !Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs
      ? endMs - startMs
      : DEFAULT_EVENT_DURATION_MS;

  const hours = Number.isNaN(wallStart.getTime()) ? 0 : wallStart.getHours();
  const minutes = Number.isNaN(wallStart.getTime()) ? 0 : wallStart.getMinutes();
  const inputValue = `${targetDay.getFullYear()}-${pad2(targetDay.getMonth() + 1)}-${pad2(targetDay.getDate())}T${pad2(hours)}:${pad2(minutes)}`;
  const newStartISO = inputValueToISO(inputValue);
  const newEndISO = new Date(Date.parse(newStartISO) + durationMs).toISOString();

  const newStartWall = isoToWallDate(newStartISO);
  const libraryPath = `${getISOWeekYear(newStartWall)}/week ${getISOWeekNumber(newStartWall)}`;

  const { id, dateISO, endDateISO, libraryPath: _ignored, ...rest } = source;
  void id;
  void dateISO;
  void endDateISO;
  void _ignored;

  return {
    ...rest,
    dateISO: newStartISO,
    endDateISO: newEndISO,
    libraryPath,
  };
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const getTransparentColor = (color: string, alpha = 0.15) => {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const normalized = hex.length === 3
      ? hex.split('').map((char) => char + char).join('')
      : hex;
    if (normalized.length === 6) {
      const numeric = parseInt(normalized, 16);
      if (!Number.isNaN(numeric)) {
        const r = (numeric >> 16) & 255;
        const g = (numeric >> 8) & 255;
        const b = numeric & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    }
  }
  const rgbMatch = color.match(/^rgba?\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})(?:\s*,\s*[0-9.]+\s*)?\)$/i);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
};

const formatPillTime = (iso: string) => formatWallTime(iso);

export default function CalendarPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedEvent, setCopiedEvent] = useState<EventItem | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(COPIED_EVENT_KEY);
      return raw ? (JSON.parse(raw) as EventItem) : null;
    } catch {
      return null;
    }
  });
  const { role } = useAuth();

  const handleCopyEvent = (event: EventItem) => {
    setCopiedEvent(event);
    try {
      window.localStorage.setItem(COPIED_EVENT_KEY, JSON.stringify(event));
    } catch {
      // Ignore storage failures; in-memory clipboard still works this session.
    }
  };

  const clearCopiedEvent = () => {
    setCopiedEvent(null);
    try {
      window.localStorage.removeItem(COPIED_EVENT_KEY);
    } catch {
      // Ignore storage failures.
    }
  };

  const pasteOnDay = async (day: Date) => {
    if (!copiedEvent || role !== 'admin') return;
    try {
      await api.post('/api/events', buildPastePayload(copiedEvent, day));
      loadEvents();
    } catch (error) {
      console.error('Paste event failed:', error);
      const message =
        error instanceof Error && error.message ? error.message : 'Failed to paste event. Please try again.';
      alert(message);
    }
  };

  const isPasteMode = role === 'admin' && copiedEvent !== null;

  usePageReady(true);
  const now = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [weekStart, setWeekStart] = useState(() => getStartOfWeekMonday(now));
  const [anim, setAnim] = useState<{ phase: 'exit' | 'enter'; direction: Direction } | null>(null);

  const loadEvents = () => {
    api.get<EventItem[]>('/api/events').then(setEvents);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const byDate = useMemo(() => {
    const map: Record<string, EventItem[]> = {};
    for (const e of events) {
      const d = getLocalDateKeyFromISO(e.dateISO);
      map[d] ||= [];
      map[d].push(e);
    }
    return map;
  }, [events]);

  const minWeekStart = getStartOfWeekMonday(addDays(now, -365)).getTime();
  const maxWeekStart = getStartOfWeekMonday(addDays(now, 365)).getTime();

  const canGoPrevious = useMemo(() => {
    if (viewMode === 'week') {
      return addDays(weekStart, -7).getTime() >= minWeekStart;
    }
    const minYear = now.getFullYear() - 1;
    const minMonth = now.getMonth();
    if (currentYear < minYear) return false;
    if (currentYear === minYear && currentMonth < minMonth) return false;
    return true;
  }, [viewMode, weekStart, minWeekStart, currentYear, currentMonth, now]);

  const canGoNext = useMemo(() => {
    if (viewMode === 'week') {
      return addDays(weekStart, 7).getTime() <= maxWeekStart;
    }
    const maxYear = now.getFullYear() + 1;
    const maxMonth = now.getMonth();
    if (currentYear > maxYear) return false;
    if (currentYear === maxYear && currentMonth > maxMonth) return false;
    return true;
  }, [viewMode, weekStart, maxWeekStart, currentYear, currentMonth, now]);

  const isCurrentMonth = currentYear === now.getFullYear() && currentMonth === now.getMonth();
  const isCurrentWeek = weekStart.getTime() === getStartOfWeekMonday(now).getTime();
  const isCurrent = viewMode === 'week' ? isCurrentWeek : isCurrentMonth;

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const step = (direction: Direction) => {
    if (viewMode === 'week') {
      setWeekStart((prev) => addDays(prev, direction === 'left' ? -7 : 7));
      return;
    }
    if (direction === 'left') {
      if (currentMonth === 0) {
        setCurrentYear((year) => year - 1);
        setCurrentMonth(11);
      } else {
        setCurrentMonth((month) => month - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentYear((year) => year + 1);
        setCurrentMonth(0);
      } else {
        setCurrentMonth((month) => month + 1);
      }
    }
  };

  const navigate = (direction: Direction) => {
    if (anim) return;
    if (direction === 'left' && !canGoPrevious) return;
    if (direction === 'right' && !canGoNext) return;
    if (prefersReducedMotion()) {
      step(direction);
      return;
    }
    setAnim({ phase: 'exit', direction });
  };

  const goToToday = () => {
    if (anim || isCurrent) return;
    if (viewMode === 'week') {
      setWeekStart(getStartOfWeekMonday(now));
    } else {
      setCurrentYear(now.getFullYear());
      setCurrentMonth(now.getMonth());
    }
  };

  const changeView = (mode: ViewMode) => {
    if (mode === viewMode || anim) return;
    if (mode === 'week') {
      const base = isCurrentMonth ? now : new Date(currentYear, currentMonth, 1);
      setWeekStart(getStartOfWeekMonday(base));
    } else {
      const middleOfWeek = addDays(weekStart, 3);
      setCurrentYear(middleOfWeek.getFullYear());
      setCurrentMonth(middleOfWeek.getMonth());
    }
    setViewMode(mode);
  };

  const handleAnimationEnd = () => {
    if (!anim) return;
    if (anim.phase === 'exit') {
      step(anim.direction);
      setAnim({ phase: 'enter', direction: anim.direction });
    } else {
      setAnim(null);
    }
  };

  const animDirection =
    anim && anim.phase === 'enter'
      ? anim.direction === 'left'
        ? 'right'
        : 'left'
      : anim?.direction;
  const animClass = anim ? `calendar-anim-${anim.phase}-${animDirection}` : '';

  const monthRows = useMemo<CalendarRow[]>(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startDay = firstDayOfMonth.getDay();
    const startDayMonday = startDay === 0 ? 6 : startDay - 1;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const cells: Array<Date | null> = [];
    for (let i = 0; i < startDayMonday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(currentYear, currentMonth, d));

    const rows: CalendarRow[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const monday = addDays(firstDayOfMonth, i - startDayMonday);
      rows.push({ weekNumber: getISOWeekNumber(monday), cells: cells.slice(i, i + 7) });
    }
    return rows;
  }, [currentYear, currentMonth]);

  const weekRows = useMemo<CalendarRow[]>(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    return [{ weekNumber: getISOWeekNumber(weekStart), cells: days }];
  }, [weekStart]);

  const rows = viewMode === 'week' ? weekRows : monthRows;

  const headerLabel = useMemo(() => {
    if (viewMode === 'month') {
      return `${monthNames[currentMonth]} ${currentYear}`;
    }
    const weekEnd = addDays(weekStart, 6);
    const startStr = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endStr = weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `Week ${getISOWeekNumber(weekStart)} · ${startStr} – ${endStr}`;
  }, [viewMode, currentYear, currentMonth, weekStart]);

  const todayKey = getLocalDateKey(now);

  return (
    <div>
      <div className="calendar-toolbar">
        <h2 className="h2" style={{ margin: 0 }}>
          {headerLabel}
        </h2>
        <div className="calendar-toolbar-actions">
          <div className="calendar-view-toggle" role="group" aria-label="Calendar view">
            <button
              type="button"
              className={viewMode === 'month' ? 'active' : ''}
              aria-pressed={viewMode === 'month'}
              onClick={() => changeView('month')}
            >
              Month
            </button>
            <button
              type="button"
              className={viewMode === 'week' ? 'active' : ''}
              aria-pressed={viewMode === 'week'}
              onClick={() => changeView('week')}
            >
              Week
            </button>
          </div>
          {role === 'admin' && (
            <button
              className="btn primary"
              onClick={() => setIsCreating(true)}
            >
              + Add Event
            </button>
          )}
          <button
            className="btn"
            onClick={goToToday}
            disabled={isCurrent || !!anim}
            style={{ opacity: isCurrent ? 0.5 : 1, cursor: isCurrent ? 'not-allowed' : 'pointer' }}
          >
            Today
          </button>
          <button
            className="btn"
            onClick={() => navigate('left')}
            disabled={!canGoPrevious}
            aria-label={viewMode === 'week' ? 'Previous week' : 'Previous month'}
            style={{ opacity: canGoPrevious ? 1 : 0.5, cursor: canGoPrevious ? 'pointer' : 'not-allowed' }}
          >
            ←
          </button>
          <button
            className="btn"
            onClick={() => navigate('right')}
            disabled={!canGoNext}
            aria-label={viewMode === 'week' ? 'Next week' : 'Next month'}
            style={{ opacity: canGoNext ? 1 : 0.5, cursor: canGoNext ? 'pointer' : 'not-allowed' }}
          >
            →
          </button>
        </div>
      </div>
      {isPasteMode && copiedEvent && (
        <div className="calendar-paste-banner">
          <span>
            Copied <strong>{copiedEvent.title || 'event'}</strong> — click a day to paste it.
          </span>
          <button type="button" className="btn" onClick={clearCopiedEvent}>
            Cancel
          </button>
        </div>
      )}
      <div className="calendar-anim-viewport">
        <div
          className={`calendar-grid-with-weeks ${viewMode === 'week' ? 'calendar-week-view' : ''} ${animClass}`}
          onAnimationEnd={handleAnimationEnd}
        >
          <div className="calendar-week-number-head"></div>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="calendar-head">{d}</div>
          ))}
          {rows.map((row, rowIdx) => (
            <Fragment key={rowIdx}>
              <div className="calendar-week-number">
                {row.weekNumber}
              </div>
              {row.cells.map((cell, dayIdx) => {
                const iso = cell ? getLocalDateKey(cell) : '';
                const dayEvents = cell ? byDate[iso] || [] : [];
                const isToday = cell ? iso === todayKey : false;
                const canPasteHere = isPasteMode && !!cell;
                return (
                  <div
                    key={dayIdx}
                    className={`calendar-cell ${cell ? '' : 'empty'} ${isToday ? 'calendar-cell-today' : ''} ${canPasteHere ? 'calendar-cell-pasteable' : ''}`}
                    onClick={canPasteHere ? () => pasteOnDay(cell as Date) : undefined}
                    role={canPasteHere ? 'button' : undefined}
                    title={canPasteHere ? 'Paste copied event here' : undefined}
                  >
                    {dayIdx === 0 ? (
                      <span className="calendar-week-badge">{row.weekNumber}</span>
                    ) : null}
                    {cell ? <div className="calendar-date">{cell.getDate()}</div> : null}
                    {dayEvents.map((e) => (
                      <button
                        key={e.id}
                        className="pill"
                        style={{ borderColor: e.color, backgroundColor: getTransparentColor(e.color) }}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelected(e);
                        }}
                      >
                        {viewMode === 'week' && formatPillTime(e.dateISO)
                          ? `${formatPillTime(e.dateISO)} · ${e.title}`
                          : e.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      {selected && (
        <EventModal
          event={selected}
          onClose={() => setSelected(null)}
          onSave={loadEvents}
          onCopy={handleCopyEvent}
        />
      )}
      {isCreating && (
        <EventModal
          event={null}
          onClose={() => setIsCreating(false)}
          onSave={() => {
            loadEvents();
            setIsCreating(false);
          }}
        />
      )}
    </div>
  );
}
