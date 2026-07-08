import { EventItem } from './types';

export type SuggestibleEventField = keyof Pick<
  EventItem,
  | 'title'
  | 'activity'
  | 'venue'
  | 'program'
  | 'conductor'
  | 'soloists'
  | 'otherParticipants'
  | 'ensemble'
  | 'dress'
  | 'other'
>;

export const SUGGESTIBLE_EVENT_FIELDS: SuggestibleEventField[] = [
  'title',
  'activity',
  'venue',
  'program',
  'conductor',
  'soloists',
  'otherParticipants',
  'ensemble',
  'dress',
  'other',
];

export function isSuggestibleEventField(key: keyof EventItem): key is SuggestibleEventField {
  return (SUGGESTIBLE_EVENT_FIELDS as readonly (keyof EventItem)[]).includes(key);
}

export function collectFieldSuggestions(
  events: EventItem[],
  field: SuggestibleEventField
): string[] {
  const counts = new Map<string, { display: string; count: number }>();

  for (const event of events) {
    const raw = event[field];
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { display: trimmed, count: 1 });
    }
  }

  return Array.from(counts.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.display.localeCompare(b.display);
    })
    .map((entry) => entry.display);
}

export function buildEventFieldSuggestions(
  events: EventItem[]
): Record<SuggestibleEventField, string[]> {
  return SUGGESTIBLE_EVENT_FIELDS.reduce(
    (acc, field) => {
      acc[field] = collectFieldSuggestions(events, field);
      return acc;
    },
    {} as Record<SuggestibleEventField, string[]>
  );
}

export function filterSuggestions(
  suggestions: string[],
  query: string,
  currentValue: string,
  limit = 8
): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedCurrent = currentValue.trim().toLowerCase();

  return suggestions
    .filter((suggestion) => {
      if (suggestion.trim().toLowerCase() === normalizedCurrent) return false;
      if (!normalizedQuery) return true;
      return suggestion.toLowerCase().includes(normalizedQuery);
    })
    .slice(0, limit);
}
