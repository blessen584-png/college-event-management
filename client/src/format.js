const dateFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

export const fmtDate = (d) => dateFmt.format(new Date(d));
export const fmtTime = (d) => timeFmt.format(new Date(d)).toLowerCase();
export const fmtRange = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay
    ? `${fmtDate(s)}, ${fmtTime(s)} to ${fmtTime(e)}`
    : `${fmtDate(s)}, ${fmtTime(s)} to ${fmtDate(e)}, ${fmtTime(e)}`;
};
export const dayOf = (d) => new Date(d).getDate();
export const monthOf = (d) => new Date(d).toLocaleString('en-IN', { month: 'short' });
export const weekdayOf = (d) => new Date(d).toLocaleString('en-IN', { weekday: 'short' });

// <input type="datetime-local"> works in local time without a zone.
export const toLocalInput = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

export const isPast = (event) => new Date(event.endsAt) < new Date();
