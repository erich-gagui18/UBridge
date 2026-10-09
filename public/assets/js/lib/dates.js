// All "today" logic uses Philippine time (UTC+8). Using toISOString() returns the UTC date,
// which is still *yesterday* between 00:00 and 08:00 in the Philippines.
const TZ = 'Asia/Manila';
const ymd = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date in Philippine time as YYYY-MM-DD. */
export const todayPH = () => ymd.format(new Date());
export const yearPH = () => Number(todayPH().slice(0, 4));

/** Format a YYYY-MM-DD string (a calendar date, not an instant). */
export const fmt = (d) =>
  d
    ? new Date(d + 'T00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

/** Format a Firestore Timestamp. */
export const fmtTs = (t) =>
  t?.toDate
    ? t.toDate().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ })
    : '—';

/** Add whole days to a YYYY-MM-DD calendar date (no time zone involved). */
export const addDays = (d, n) => {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
