import { EventItem } from './types';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

// Event times are floating wall-clock values: emit them without a timezone
// suffix so every calendar app shows the exact time the admin entered.
function formatICSDate(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return (
    `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}`
  );
}

function formatICSStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICSText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function buildDescription(event: EventItem): string {
  const fields: Array<[string, string | undefined]> = [
    ['Activity', event.activity],
    ['Program', event.program],
    ['Conductor', event.conductor],
    ['Soloists', event.soloists],
    ['Other participants', event.otherParticipants],
    ['Ensemble', event.ensemble],
    ['Dress', event.dress],
    ['Other', event.other],
  ];
  return fields
    .filter(([, value]) => value && value.trim())
    .map(([label, value]) => `${label}: ${value!.trim()}`)
    .join('\n');
}

export function buildICS(event: EventItem): string {
  const dtStart = formatICSDate(event.dateISO);
  const dtEnd = formatICSDate(event.endDateISO);
  const dtStamp = formatICSStamp(new Date());
  const description = buildDescription(event);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Orchestra Manager//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@orchestra-manager`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
  ];

  if (dtEnd) {
    lines.push(`DTEND:${dtEnd}`);
  }

  lines.push(`SUMMARY:${escapeICSText(event.title || 'Event')}`);

  if (description) {
    lines.push(`DESCRIPTION:${escapeICSText(description)}`);
  }

  if (event.venue && event.venue.trim()) {
    lines.push(`LOCATION:${escapeICSText(event.venue.trim())}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
}

function buildFileName(event: EventItem): string {
  const base = (event.title || 'event').trim().toLowerCase();
  const safe = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'event';
  return `${safe}.ics`;
}

export function downloadICS(event: EventItem): void {
  const blob = new Blob([buildICS(event)], { type: 'text/calendar;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = buildFileName(event);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
