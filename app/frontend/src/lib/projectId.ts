import { getISOWeekNumber, getISOWeekYear, isoToWallDate } from './date';
import { EventItem } from './types';
import { api } from './api';

export type WeekKey = string;

type EventLike = Partial<EventItem> & Pick<EventItem, 'dateISO' | 'title' | 'color'>;

export function getWeekKeyFromDate(date: Date): WeekKey {
  if (Number.isNaN(date.getTime())) return '';
  const yearShort = getISOWeekYear(date) % 100;
  const weekNum = getISOWeekNumber(date);
  return `${yearShort}|${weekNum}`;
}

export function getWeekKeyFromISO(dateISO: string): WeekKey {
  return getWeekKeyFromDate(isoToWallDate(dateISO));
}

export function normalizeColor(color: string): string {
  let hex = (color || '').trim().toLowerCase();
  if (!hex) return '';
  if (!hex.startsWith('#')) hex = `#${hex}`;
  const raw = hex.slice(1);
  if (raw.length === 3) {
    return `#${raw.split('').map((char) => char + char).join('')}`;
  }
  return hex;
}

export function normalizeTitle(title: string): string {
  return (title || '').trim().toLowerCase();
}

export function formatProjectId(yearShort: number, weekNum: number, index: number): string {
  return `${String(yearShort).padStart(2, '0')}-${String(weekNum).padStart(2, '0')}-${index}`;
}

export function getProjectGroupKey(event: EventLike): string {
  const weekKey = getWeekKeyFromISO(event.dateISO);
  if (!weekKey) return '';
  const [yearShort, weekNum] = weekKey.split('|');
  return `${yearShort}|${weekNum}|${normalizeColor(event.color)}|${normalizeTitle(event.title)}`;
}

function eventInWeek(event: Partial<EventItem>, weekKey: WeekKey): boolean {
  return !!event.dateISO && getWeekKeyFromISO(event.dateISO) === weekKey;
}

export function computeAutoProjectIdsForWeek(
  weekKey: WeekKey,
  events: Array<Partial<EventItem> & { id?: string }>
): Map<string, string> {
  const result = new Map<string, string>();
  if (!weekKey) return result;

  const autoEvents = events.filter(
    (event) => event.id && eventInWeek(event, weekKey) && !event.projectIdOverridden
  );

  const groups = new Map<string, Array<Partial<EventItem> & { id?: string }>>();
  for (const event of autoEvents) {
    const groupKey = getProjectGroupKey(event as EventLike);
    if (!groupKey) continue;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey)!.push(event);
  }

  const [yearShortStr, weekNumStr] = weekKey.split('|');
  const yearShort = Number(yearShortStr);
  const weekNum = Number(weekNumStr);

  const sortedGroups = [...groups.entries()].sort((a, b) => {
    const earliestA = a[1].reduce((min, event) => {
      const dateISO = event.dateISO || '';
      return !min || dateISO < min ? dateISO : min;
    }, '');
    const earliestB = b[1].reduce((min, event) => {
      const dateISO = event.dateISO || '';
      return !min || dateISO < min ? dateISO : min;
    }, '');
    if (earliestA !== earliestB) return earliestA.localeCompare(earliestB);
    return a[0].localeCompare(b[0]);
  });

  sortedGroups.forEach(([, groupEvents], index) => {
    const projectId = formatProjectId(yearShort, weekNum, index + 1);
    for (const event of groupEvents) {
      if (event.id) result.set(event.id, projectId);
    }
  });

  return result;
}

export function computeAutoProjectId(
  event: Partial<EventItem>,
  allEvents: EventItem[],
  options?: { eventId?: string; includeDraft?: boolean }
): string {
  const weekKey = getWeekKeyFromISO(event.dateISO || '');
  if (!weekKey) return '';

  const eventId = options?.eventId;
  const workingEvents: Array<Partial<EventItem> & { id?: string }> = [...allEvents];

  if (eventId) {
    const index = workingEvents.findIndex((item) => item.id === eventId);
    if (index >= 0) {
      workingEvents[index] = { ...workingEvents[index], ...event, id: eventId };
    } else if (options?.includeDraft) {
      workingEvents.push({ ...event, id: eventId });
    }
  }

  const computed = computeAutoProjectIdsForWeek(weekKey, workingEvents);
  if (eventId) return computed.get(eventId) || '';
  return '';
}

export function getEffectiveProjectId(
  event: Partial<EventItem> & Pick<EventItem, 'dateISO'>,
  allEvents: EventItem[],
  options?: { eventId?: string }
): string {
  const manual = (event.projectId || '').trim();
  if (event.projectIdOverridden) return manual;

  const eventId = options?.eventId ?? ('id' in event ? event.id : undefined);
  if (eventId && event.dateISO) {
    const computed = computeAutoProjectId(event, allEvents, {
      eventId,
      includeDraft: true,
    }).trim();
    if (computed) return computed;
  }

  return manual;
}

export function collectWeekKeys(events: Array<Partial<EventItem>>): WeekKey[] {
  return [...new Set(events.map((event) => getWeekKeyFromISO(event.dateISO || '')).filter(Boolean))];
}

export function eventsNeedProjectIdSync(events: EventItem[]): boolean {
  return events.some((event) => {
    if (event.projectIdOverridden) return false;
    const weekKey = getWeekKeyFromISO(event.dateISO);
    if (!weekKey) return !event.projectId;
    const computed = computeAutoProjectIdsForWeek(weekKey, events);
    const expected = computed.get(event.id);
    return !expected || event.projectId !== expected;
  });
}

export async function syncProjectIdsForWeeks(
  events: EventItem[],
  weekKeys: WeekKey[]
): Promise<void> {
  const updates: Array<{ id: string; projectId: string }> = [];

  for (const weekKey of weekKeys) {
    if (!weekKey) continue;
    const computed = computeAutoProjectIdsForWeek(weekKey, events);
    for (const [id, projectId] of computed) {
      const existing = events.find((event) => event.id === id);
      if (!existing || existing.projectIdOverridden) continue;
      if (existing.projectId !== projectId) {
        updates.push({ id, projectId });
      }
    }
  }

  if (updates.length === 0) return;

  await Promise.all(
    updates.map(({ id, projectId }) =>
      api.put(`/api/events/${id}`, { projectId, projectIdOverridden: false })
    )
  );
}

export async function syncProjectIdsForAllEvents(events: EventItem[]): Promise<void> {
  await syncProjectIdsForWeeks(events, collectWeekKeys(events));
}

export function findEventByProjectId(events: EventItem[], projectId: string): EventItem | null {
  const normalized = projectId.trim();
  if (!normalized) return null;

  const matches = events.filter((event) => (event.projectId || '').trim() === normalized);
  if (matches.length === 0) return null;

  return matches.sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0];
}

const CREATE_TEMPLATE_FIELDS: Array<keyof EventItem> = [
  'color',
  'title',
  'program',
  'programRows',
  'conductor',
  'soloists',
  'otherParticipants',
  'ensemble',
  'activity',
  'venue',
  'dress',
  'other',
  'libraryPath',
];

export function buildCreateFormFromProjectId(
  source: EventItem,
  draft: Partial<EventItem>
): Partial<EventItem> {
  const template: Partial<EventItem> = {
    projectId: draft.projectId,
    projectIdOverridden: true,
    dateISO: draft.dateISO,
    endDateISO: draft.endDateISO,
  };

  for (const key of CREATE_TEMPLATE_FIELDS) {
    Object.assign(template, { [key]: source[key] });
  }

  return template;
}
