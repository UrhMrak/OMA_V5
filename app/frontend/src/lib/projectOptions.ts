import { EventItem } from './types';
import { WeekKey, getWeekKeyFromDate, getWeekKeyFromISO } from './projectId';
import {
  addDays,
  getLocalDateKey,
  getLocalDateKeyFromISO,
  getStartOfWeekMonday,
} from './date';

export const PROJECT_QUERY_PARAM = 'project';

export type ProjectOption = {
  projectId: string;
  title: string;
  earliestDateISO: string;
  latestDateISO: string;
  weekKeys: Set<WeekKey>;
};

export function buildProjectOptions(events: EventItem[]): ProjectOption[] {
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
export function findDefaultProjectId(options: ProjectOption[], now: Date): string {
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

export function formatProjectLabel(projectId: string, title: string): string {
  return title ? `${projectId} - ${title}` : projectId;
}
