function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Event times are stored as floating wall-clock values anchored to UTC, so the
// time an admin enters is shown identically to every viewer regardless of their
// timezone. The helpers below read/write the UTC components of an ISO string.
export function getLocalDateKeyFromISO(iso: string | null | undefined): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(parsed.getUTCDate())}`;
}

export function formatWallTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

export function formatEventHeadingDateTime(
  startISO: string | null | undefined,
  endISO: string | null | undefined,
  locale?: string,
  options?: { includeWeekday?: boolean }
): string {
  const start = isoToWallDate(startISO);
  if (Number.isNaN(start.getTime())) return '';

  const weekdayText = options?.includeWeekday
    ? start.toLocaleDateString(locale, { weekday: 'long' })
    : '';
  const dateText = start.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  const startTime = formatWallTime(startISO);
  const endTime = formatWallTime(endISO);

  let result = '';
  if (startTime && endTime) result = `${dateText}, ${startTime} - ${endTime}`;
  else if (startTime) result = `${dateText}, ${startTime}`;
  else result = dateText;

  if (weekdayText) return `${weekdayText}, ${result}`;
  return result;
}

export function isoToInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

export function inputValueToISO(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return '';
  const [, year, month, day, hours, minutes] = match;
  return new Date(Date.UTC(+year, +month - 1, +day, +hours, +minutes)).toISOString();
}

export function isoToWallDate(iso: string | null | undefined): Date {
  const date = iso ? new Date(iso) : new Date(NaN);
  if (Number.isNaN(date.getTime())) return new Date(NaN);
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes()
  );
}

export function nowFloatingISO(): string {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes()
    )
  ).toISOString();
}

export function defaultNewEventRangeISO(referenceDate = new Date()): {
  dateISO: string;
  endDateISO: string;
} {
  const datePart = `${referenceDate.getFullYear()}-${pad2(referenceDate.getMonth() + 1)}-${pad2(referenceDate.getDate())}`;
  return {
    dateISO: inputValueToISO(`${datePart}T10:00`),
    endDateISO: inputValueToISO(`${datePart}T13:00`),
  };
}

export function isSameLocalDay(iso: string | null | undefined, reference: Date): boolean {
  if (!iso) return false;
  return getLocalDateKeyFromISO(iso) === getLocalDateKey(reference);
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export function isEventInPulseWindow(
  startISO: string | null | undefined,
  endISO: string | null | undefined,
  now: Date = new Date()
): boolean {
  const start = isoToWallDate(startISO);
  if (Number.isNaN(start.getTime())) return false;

  const end = endISO ? isoToWallDate(endISO) : start;
  if (Number.isNaN(end.getTime())) return false;

  const nowMs = now.getTime();
  return nowMs >= start.getTime() - ONE_HOUR_MS && nowMs <= end.getTime();
}

function getISOWeekContext(date: Date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayOfWeek);
  const isoYear = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoYear, isoWeek };
}

export function getISOWeekNumber(date: Date): number {
  return getISOWeekContext(date).isoWeek;
}

export function getISOWeekYear(date: Date): number {
  return getISOWeekContext(date).isoYear;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getStartOfWeekMonday(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfWeek = result.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  result.setDate(result.getDate() + diffToMonday);
  return result;
}

