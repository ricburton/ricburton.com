export const TIME_ZONE = 'America/Los_Angeles';
export function pacificDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: TIME_ZONE, year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get = key => parts.find(p => p.type === key).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export const addDays = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0,10);
export const formatDay = (day, options = {}) => new Intl.DateTimeFormat('en-US', {timeZone:'UTC',...options}).format(new Date(`${day}T12:00:00Z`));
export const daysOld = (day, today) => Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`))/86400000);
export function statusOf(e, now = new Date()) {
  const day = pacificDay(now);
  if (e.status === 'cancelled') return 'Cancelled';
  if (e.end ? now >= new Date(e.end) : e.endDate < day) return 'Past';
  if (e.start && now >= new Date(e.start)) return 'Happening now';
  if (e.startDate <= day && e.endDate >= day) return 'Today';
  if (e.startDate === addDays(day,1)) return 'Tomorrow';
  return 'Upcoming';
}
export function filterEvents(events, filters, now = new Date(), saved = new Set()) {
  const today = pacificDay(now);
  const q = (filters.query || '').trim().toLowerCase();
  return events.filter(e => {
    const future = !['Past','Cancelled'].includes(statusOf(e, now));
    if (filters.range !== 'all' && !future) return false;
    if (filters.range === 'week' && (e.startDate > addDays(today,6) || e.endDate < today)) return false;
    if (filters.region && filters.region !== 'all' && e.region !== filters.region) return false;
    if (filters.type && filters.type !== 'all' && e.type !== filters.type) return false;
    if (filters.savedOnly && !saved.has(e.id)) return false;
    return !q || [e.title,e.organizer,e.city,e.venue,e.description,e.type,e.region,e.notes].join(' ').toLowerCase().includes(q);
  }).sort((a,b) => (a.startDate + (a.start || '')).localeCompare(b.startDate + (b.start || '')) || a.title.localeCompare(b.title));
}
export const eventsOnDay = (events, day) => events.filter(e => e.startDate <= day && e.endDate >= day);
export function calendarDays(month) {
  const first = `${month}-01`;
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
  const start = addDays(first,-weekday);
  return Array.from({length:42},(_,i)=>addDays(start,i));
}
const escapeICS = value => String(value || '').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
const stamp = value => new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
function foldLine(line) {
  let result = '', current = '', bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 75) { result += current + '\r\n'; current = ' '; bytes = 1; }
    current += char; bytes += size;
  }
  return result + current;
}
export function toICS(events) {
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Richard Burton//Bay Area Robotics//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:Bay Area Robotics','X-WR-TIMEZONE:America/Los_Angeles','REFRESH-INTERVAL;VALUE=DURATION:P1D'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT',`UID:${e.id}@ricburton.com`,`DTSTAMP:${e.verified.replace(/-/g,'')}T120000Z`,`LAST-MODIFIED:${e.verified.replace(/-/g,'')}T120000Z`);
    if (e.start && e.end) lines.push(`DTSTART:${stamp(e.start)}`,`DTEND:${stamp(e.end)}`);
    else lines.push(`DTSTART;VALUE=DATE:${e.startDate.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${addDays(e.endDate,1).replace(/-/g,'')}`);
    const unknown = !e.start || !e.end;
    lines.push(`SUMMARY:${escapeICS(e.title + (unknown ? ' (time to confirm)' : ''))}`,`LOCATION:${escapeICS([e.venue,e.city].filter(Boolean).join(', '))}`,`DESCRIPTION:${escapeICS([e.description,e.schedule,e.notes,e.admission,`Verified ${e.verified}. Confirm details with organizer: ${e.source}`].filter(Boolean).join('\n\n'))}`,`URL:${e.source}`,`STATUS:${e.status === 'cancelled' ? 'CANCELLED' : unknown ? 'TENTATIVE' : 'CONFIRMED'}`,'TRANSP:TRANSPARENT','END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
