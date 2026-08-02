import { useMemo, useRef, useState, Fragment } from 'react';
import { EventItem } from '../lib/types';
import { useEvents } from '../context/EventsContext';
import { useEventSize } from '../context/EventSizeContext';
import { useLanguage } from '../context/LanguageContext';
import { useAppPreferences } from '../context/AppPreferencesContext';
import { api } from '../lib/api';
import EventModal from '../components/Calendar/EventModal';
import { useAuth } from '../context/AuthContext';
import { usePageReady } from '../components/Layout/PageTransition';
import {
  getLocalDateKey,
  getLocalDateKeyFromISO,
  getISOWeekNumber,
  addDays,
  getStartOfWeekMonday,
  formatWallTime,
  isoToWallDate,
  inputValueToISO,
  defaultNewEventRangeISO,
} from '../lib/date';
import { downloadMonthICS, downloadWeekICS } from '../lib/ics';
import { getWeekKeyFromISO, getEffectiveProjectId, syncProjectIdsForWeeks } from '../lib/projectId';

type ViewMode = 'month' | 'week';
type Direction = 'left' | 'right';
type CalendarRow = { weekNumber: number; cells: Date[] };

const MONTH_GRID_WEEKS = 6;
const MONTH_GRID_DAYS = MONTH_GRID_WEEKS * 7;

const DEFAULT_EVENT_DURATION_MS = 3 * 60 * 60 * 1000;
const COPIED_EVENT_KEY = 'oma:copiedEvent';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function buildPastePayload(
  source: EventItem,
  targetDay: Date,
  allEvents: EventItem[]
): Partial<EventItem> {
  const effectiveProjectId = getEffectiveProjectId(source, allEvents);
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

  const { id, dateISO, endDateISO, libraryPath: _ignored, projectId: _projectId, projectIdOverridden: _projectIdOverridden, ...rest } = source;
  void id;
  void dateISO;
  void endDateISO;
  void _ignored;
  void _projectId;
  void _projectIdOverridden;

  return {
    ...rest,
    dateISO: newStartISO,
    endDateISO: newEndISO,
    ...(effectiveProjectId
      ? { projectId: effectiveProjectId, projectIdOverridden: true }
      : {}),
  };
}

function buildCreateDraftForDay(day: Date): Partial<EventItem> {
  return defaultNewEventRangeISO(day);
}

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
  const { events, loadEvents } = useEvents();
  const { eventSize } = useEventSize();
  const { t, dict, locale } = useLanguage();
  const { defaultCalendarView } = useAppPreferences();
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [createDraft, setCreateDraft] = useState<Partial<EventItem> | null>(null);
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
    const projectId = getEffectiveProjectId(event, events);
    const copied: EventItem = {
      ...event,
      ...(projectId ? { projectId, projectIdOverridden: true } : {}),
    };
    setCopiedEvent(copied);
    try {
      window.localStorage.setItem(COPIED_EVENT_KEY, JSON.stringify(copied));
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
      const payload = buildPastePayload(copiedEvent, day, events);
      const preservedProjectId = payload.projectIdOverridden === true;
      await api.post('/api/events', payload);
      if (!preservedProjectId) {
        const weekKey = payload.dateISO ? getWeekKeyFromISO(payload.dateISO) : '';
        if (weekKey) {
          const freshEvents = await api.get<EventItem[]>('/api/events');
          await syncProjectIdsForWeeks(freshEvents, [weekKey]);
        }
      }
      await loadEvents();
    } catch (error) {
      console.error('Paste event failed:', error);
      const message =
        error instanceof Error && error.message ? error.message : t('calendar.pasteFailed');
      alert(message);
    }
  };

  const isPasteMode = role === 'admin' && copiedEvent !== null;

  const handleDayClick = (day: Date) => {
    if (isPasteMode) {
      void pasteOnDay(day);
      return;
    }
    if (role === 'admin') {
      setCreateDraft(buildCreateDraftForDay(day));
    }
  };

  usePageReady(true);
  const now = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>(defaultCalendarView);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [weekStart, setWeekStart] = useState(() => getStartOfWeekMonday(now));
  const [anim, setAnim] = useState<{ phase: 'exit' | 'enter'; direction: Direction } | null>(null);

  const byDate = useMemo(() => {
    const map: Record<string, EventItem[]> = {};
    for (const e of events) {
      const d = getLocalDateKeyFromISO(e.dateISO);
      map[d] ||= [];
      map[d].push(e);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => Date.parse(a.dateISO) - Date.parse(b.dateISO));
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

  const SWIPE_MIN_DISTANCE_PX = 50;
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE_PX || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    navigate(deltaX < 0 ? 'right' : 'left');
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

  const animDirection = anim
    ? anim.phase === 'enter'
      ? anim.direction
      : anim.direction === 'left'
        ? 'right'
        : 'left'
    : undefined;
  const animClass = anim ? `calendar-anim-${anim.phase}-${animDirection}` : '';

  const monthRows = useMemo<CalendarRow[]>(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startDay = firstDayOfMonth.getDay();
    const startDayMonday = startDay === 0 ? 6 : startDay - 1;
    const gridStart = addDays(firstDayOfMonth, -startDayMonday);

    const cells = Array.from({ length: MONTH_GRID_DAYS }, (_, i) => addDays(gridStart, i));

    const rows: CalendarRow[] = [];
    for (let i = 0; i < MONTH_GRID_DAYS; i += 7) {
      rows.push({ weekNumber: getISOWeekNumber(cells[i]), cells: cells.slice(i, i + 7) });
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
      return `${dict.calendar.months[currentMonth]} ${currentYear}`;
    }
    const weekEnd = addDays(weekStart, 6);
    const startStr = weekStart.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    const endStr = weekEnd.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
    return t('calendar.weekHeader', {
      week: getISOWeekNumber(weekStart),
      start: startStr,
      end: endStr,
    });
  }, [viewMode, currentYear, currentMonth, weekStart, dict, locale, t]);

  const todayKey = getLocalDateKey(now);

  const monthEvents = useMemo(() => {
    return events
      .filter((e) => {
        const parsed = new Date(e.dateISO);
        if (Number.isNaN(parsed.getTime())) return false;
        return parsed.getUTCFullYear() === currentYear && parsed.getUTCMonth() === currentMonth;
      })
      .sort((a, b) => Date.parse(a.dateISO) - Date.parse(b.dateISO));
  }, [events, currentYear, currentMonth]);

  const weekDateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (let i = 0; i < 7; i++) {
      keys.add(getLocalDateKey(addDays(weekStart, i)));
    }
    return keys;
  }, [weekStart]);

  const weekEvents = useMemo(() => {
    return events
      .filter((e) => weekDateKeys.has(getLocalDateKeyFromISO(e.dateISO)))
      .sort((a, b) => Date.parse(a.dateISO) - Date.parse(b.dateISO));
  }, [events, weekDateKeys]);

  const visiblePeriodEvents = viewMode === 'month' ? monthEvents : weekEvents;

  return (
    <div>
      <div className="calendar-toolbar">
        <h2 className="h2" style={{ margin: 0 }}>
          {headerLabel}
        </h2>
        <div className="calendar-toolbar-actions">
          <div className="calendar-view-toggle" role="group" aria-label={t('calendar.viewLabel')}>
            <button
              type="button"
              className={viewMode === 'month' ? 'active' : ''}
              aria-pressed={viewMode === 'month'}
              onClick={() => changeView('month')}
            >
              {t('calendar.month')}
            </button>
            <button
              type="button"
              className={viewMode === 'week' ? 'active' : ''}
              aria-pressed={viewMode === 'week'}
              onClick={() => changeView('week')}
            >
              {t('calendar.week')}
            </button>
          </div>
          {role === 'admin' && (
            <button
              className="btn primary"
              onClick={() => setCreateDraft({})}
            >
              {t('calendar.addEvent')}
            </button>
          )}
          <button
            className="btn"
            onClick={goToToday}
            disabled={isCurrent || !!anim}
            style={{ opacity: isCurrent ? 0.5 : 1, cursor: isCurrent ? 'not-allowed' : 'pointer' }}
          >
            {t('calendar.today')}
          </button>
          <button
            className="btn"
            onClick={() => navigate('left')}
            disabled={!canGoPrevious}
            aria-label={viewMode === 'week' ? t('calendar.prevWeek') : t('calendar.prevMonth')}
            style={{ opacity: canGoPrevious ? 1 : 0.5, cursor: canGoPrevious ? 'pointer' : 'not-allowed' }}
          >
            ←
          </button>
          <button
            className="btn"
            onClick={() => navigate('right')}
            disabled={!canGoNext}
            aria-label={viewMode === 'week' ? t('calendar.nextWeek') : t('calendar.nextMonth')}
            style={{ opacity: canGoNext ? 1 : 0.5, cursor: canGoNext ? 'pointer' : 'not-allowed' }}
          >
            →
          </button>
        </div>
      </div>
      {isPasteMode && copiedEvent && (
        <div className="calendar-paste-banner">
          <span>
            {t('calendar.copiedBannerPrefix')}
            <strong>{copiedEvent.title || t('calendar.eventFallback')}</strong>
            {t('calendar.copiedBannerSuffix')}
          </span>
          <button type="button" className="btn" onClick={clearCopiedEvent}>
            {t('calendar.cancel')}
          </button>
        </div>
      )}
      <div
        className="calendar-anim-viewport"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={`calendar-grid-with-weeks ${viewMode === 'week' ? 'calendar-week-view' : ''} ${eventSize === 'compact' ? 'calendar-events-compact' : ''} ${animClass}`}
          onAnimationEnd={handleAnimationEnd}
        >
          <div className="calendar-week-number-head"></div>
          {dict.calendar.weekdays.map((d) => (
            <div key={d} className="calendar-head">{d}</div>
          ))}
          {rows.map((row, rowIdx) => (
            <Fragment key={rowIdx}>
              <div className="calendar-week-number">
                {row.weekNumber}
              </div>
              {row.cells.map((cell, dayIdx) => {
                const iso = getLocalDateKey(cell);
                const dayEvents = byDate[iso] || [];
                const isToday = iso === todayKey;
                const isAdjacentMonth =
                  viewMode === 'month' &&
                  (cell.getFullYear() !== currentYear || cell.getMonth() !== currentMonth);
                const canPasteHere = isPasteMode;
                const canCreateHere = role === 'admin' && !isPasteMode;
                return (
                  <div
                    key={dayIdx}
                    className={`calendar-cell ${isAdjacentMonth ? 'calendar-cell-adjacent' : ''} ${isToday ? 'calendar-cell-today' : ''} ${canPasteHere ? 'calendar-cell-pasteable' : ''} ${canCreateHere ? 'calendar-cell-clickable' : ''}`}
                    onClick={() => handleDayClick(cell)}
                    role={canPasteHere || canCreateHere ? 'button' : undefined}
                    title={canPasteHere ? t('calendar.pasteHere') : undefined}
                  >
                    {dayIdx === 0 ? (
                      <span className="calendar-week-badge">{row.weekNumber}</span>
                    ) : null}
                    <div className="calendar-date">{cell.getDate()}</div>
                    {dayEvents.map((e) => {
                      const topLine = [formatPillTime(e.dateISO), e.activity]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <button
                          key={e.id}
                          className="pill"
                          style={{ borderColor: e.color, backgroundColor: getTransparentColor(e.color) }}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setSelected(e);
                          }}
                        >
                          {topLine ? <span className="pill-top">{topLine}</span> : null}
                          <span className="pill-title">{e.title}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <div className="calendar-period-footer">
        <button
          type="button"
          className="btn"
          disabled={visiblePeriodEvents.length === 0}
          onClick={() => {
            if (viewMode === 'month') {
              downloadMonthICS(
                monthEvents,
                currentYear,
                currentMonth,
                dict.calendar.months[currentMonth],
              );
            } else {
              downloadWeekICS(weekEvents, getISOWeekNumber(weekStart), weekStart.getFullYear());
            }
          }}
        >
          {viewMode === 'month'
            ? t('calendar.addMonthToCalendar', {
                month: dict.calendar.months[currentMonth],
                count: monthEvents.length,
              })
            : t('calendar.addWeekToCalendar', { count: weekEvents.length })}
        </button>
      </div>
      {selected && (
        <EventModal
          event={selected}
          onClose={() => setSelected(null)}
          onSave={loadEvents}
          onCopy={handleCopyEvent}
        />
      )}
      {createDraft !== null && (
        <EventModal
          event={null}
          draft={createDraft}
          onClose={() => setCreateDraft(null)}
          onSave={() => {
            loadEvents();
            setCreateDraft(null);
          }}
        />
      )}
    </div>
  );
}
