import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../toast.jsx';
import { seatState } from '../components/EventCard.jsx';
import { ErrorNote, Loading } from '../components/ui.jsx';
import { dayOf, fmtRange, isPast, monthOf, weekdayOf } from '../format.js';

export default function EventDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    return api(`/events/${id}`).then((d) => { setEvent(d.event); setError(''); }).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { load(); }, [load, user?._id]);

  const run = async (fn, okMessage) => {
    setBusy(true);
    try {
      await fn();
      if (okMessage) toast(okMessage);
      await load();
    } catch (e) {
      toast(e.message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const register = () => run(() => api(`/events/${id}/register`, { method: 'POST' }), 'You’re registered. See you there.');
  const cancelReg = () => run(() => api(`/events/${id}/register`, { method: 'DELETE' }), 'Registration cancelled.');
  const toggleStatus = () =>
    run(() => api(`/events/${id}`, { method: 'PUT', body: { status: event.status === 'cancelled' ? 'published' : 'cancelled' } }),
      event.status === 'cancelled' ? 'Event reopened.' : 'Event marked as cancelled.');
  const remove = async () => {
    if (!window.confirm(`Delete “${event.title}”? Registrations will be removed too. This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api(`/events/${id}`, { method: 'DELETE' });
      toast('Event deleted.');
      navigate('/dashboard');
    } catch (e) {
      toast(e.message, 'bad');
      setBusy(false);
    }
  };

  if (error) return <div className="page narrow"><ErrorNote message={error} /><Link to="/" className="btn btn-quiet">Back to events</Link></div>;
  if (!event) return <Loading label="Loading event" />;

  const state = seatState(event);
  const ended = isPast(event);
  const pct = Math.min(100, Math.round((event.registeredCount / event.capacity) * 100));
  const closed = event.status === 'cancelled' || ended;

  return (
    <div className="page">
      <Link to="/" className="back">Back to events</Link>
      <div className="detail">
        <article>
          <div className="detail-title">
            <div className={`stub stub-big stub-${event.status === 'cancelled' ? 'cancelled' : ended ? 'past' : 'live'}`}>
              <span className="stub-day">{dayOf(event.startsAt)}</span>
              <span className="stub-month">{monthOf(event.startsAt)}</span>
              <span className="stub-wd">{weekdayOf(event.startsAt)}</span>
            </div>
            <div>
              <span className="chip">{event.category}</span>
              {event.status === 'cancelled' && <span className="chip chip-bad">Cancelled</span>}
              <h1>{event.title}</h1>
            </div>
          </div>

          <dl className="facts">
            <div><dt>When</dt><dd>{fmtRange(event.startsAt, event.endsAt)}</dd></div>
            <div><dt>Where</dt><dd>{event.venue}</dd></div>
            <div><dt>Organised by</dt><dd>{event.organizer?.name}{event.organizer?.department ? `, ${event.organizer.department}` : ''}</dd></div>
          </dl>

          <h2>About this event</h2>
          <p className="prose">{event.description}</p>
        </article>

        <aside className="panel" aria-label="Registration">
          <div className="meter big" aria-hidden="true"><span className={`fill fill-${state.tone}`} style={{ width: `${pct}%` }} /></div>
          <p className="panel-count"><strong>{event.registeredCount}</strong> of {event.capacity} seats taken</p>
          <p className={`seat-text tone-${state.tone}`}>{state.text}</p>

          {!user ? (
            <Link className="btn btn-primary block" to="/login" state={{ from: location.pathname }}>Log in to register</Link>
          ) : event.isRegistered ? (
            <button className="btn btn-danger block" onClick={cancelReg} disabled={busy || ended}>Cancel my registration</button>
          ) : (
            <button className="btn btn-primary block" onClick={register} disabled={busy || closed || event.seatsLeft === 0}>
              {event.status === 'cancelled' ? 'Event cancelled' : ended ? 'Event ended' : event.seatsLeft === 0 ? 'Event full' : 'Register'}
            </button>
          )}

          {event.canManage && (
            <div className="manage">
              <h3>Manage</h3>
              <Link className="btn btn-quiet block" to={`/events/${id}/attendees`}>View attendees</Link>
              <Link className="btn btn-quiet block" to={`/events/${id}/edit`}>Edit event</Link>
              <button className="btn btn-quiet block" onClick={toggleStatus} disabled={busy}>
                {event.status === 'cancelled' ? 'Reopen event' : 'Mark as cancelled'}
              </button>
              <button className="btn btn-danger-quiet block" onClick={remove} disabled={busy}>Delete event</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
