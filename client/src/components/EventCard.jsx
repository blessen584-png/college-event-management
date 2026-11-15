import { Link } from 'react-router-dom';
import { dayOf, fmtTime, isPast, monthOf, weekdayOf } from '../format.js';

export function seatState(e) {
  if (e.status === 'cancelled') return { text: 'Cancelled', tone: 'bad' };
  if (isPast(e)) return { text: 'Ended', tone: 'muted' };
  if (e.isRegistered) return { text: 'You’re registered', tone: 'good' };
  if (e.seatsLeft === 0) return { text: 'Full', tone: 'bad' };
  if (e.seatsLeft <= Math.max(3, Math.ceil(e.capacity * 0.15))) return { text: `Only ${e.seatsLeft} seats left`, tone: 'warn' };
  return { text: `${e.seatsLeft} seats left`, tone: 'ok' };
}

export default function EventCard({ event }) {
  const state = seatState(event);
  const pct = Math.min(100, Math.round((event.registeredCount / event.capacity) * 100));
  const stubTone = event.status === 'cancelled' ? 'cancelled' : isPast(event) ? 'past' : 'live';

  return (
    <Link to={`/events/${event._id}`} className="ticket">
      <div className={`stub stub-${stubTone}`}>
        <span className="stub-day">{dayOf(event.startsAt)}</span>
        <span className="stub-month">{monthOf(event.startsAt)}</span>
        <span className="stub-wd">{weekdayOf(event.startsAt)}</span>
      </div>
      <div className="ticket-body">
        <span className="chip">{event.category}</span>
        <h3>{event.title}</h3>
        <p className="meta">{fmtTime(event.startsAt)} at {event.venue}</p>
        <div className="seats">
          <div className="meter" aria-hidden="true"><span className={`fill fill-${state.tone}`} style={{ width: `${pct}%` }} /></div>
          <span className={`seat-text tone-${state.tone}`}>{state.text}</span>
        </div>
      </div>
    </Link>
  );
}
