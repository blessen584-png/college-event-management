import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../toast.jsx';
import { ErrorNote, Loading, StatStrip } from '../components/ui.jsx';
import { fmtDate, fmtTime } from '../format.js';

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api('/dashboard').then(setData).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="page"><ErrorNote message={error} /></div>;
  if (!data) return <Loading />;

  const cancel = async (eventId) => {
    try {
      await api(`/events/${eventId}/register`, { method: 'DELETE' });
      toast('Registration cancelled.');
      load();
    } catch (e) {
      toast(e.message, 'bad');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Hello, {user.name}</h1>
          <p className="lede">
            {data.role === 'student' && 'Your registrations and what’s coming up.'}
            {data.role === 'organizer' && 'How your events are doing.'}
            {data.role === 'admin' && 'A snapshot of events and people across campus.'}
          </p>
        </div>
        {data.role !== 'student' && <Link to="/events/new" className="btn btn-primary">Create event</Link>}
      </div>

      {data.role === 'student' && <StudentView data={data} onCancel={cancel} />}
      {data.role === 'organizer' && <OrganizerView data={data} />}
      {data.role === 'admin' && <AdminView data={data} />}
    </div>
  );
}

function StudentView({ data, onCancel }) {
  return (
    <>
      <StatStrip items={[
        { label: 'Upcoming', value: data.stats.upcoming },
        { label: 'Attended', value: data.stats.attended },
        { label: 'All registrations', value: data.stats.total },
      ]} />
      <h2>Your upcoming events</h2>
      {data.upcoming.length === 0 ? (
        <div className="empty"><h2>Nothing booked yet</h2><p>Browse what’s on and register for something.</p><Link className="btn btn-primary" to="/">Find events</Link></div>
      ) : (
        <ul className="rows">
          {data.upcoming.map(({ _id, event }) => (
            <li key={_id}>
              <div>
                <Link to={`/events/${event._id}`} className="row-title">{event.title}</Link>
                <span className="muted">{fmtDate(event.startsAt)}, {fmtTime(event.startsAt)} at {event.venue}</span>
                {event.status === 'cancelled' && <span className="chip chip-bad">Cancelled</span>}
              </div>
              <button className="btn btn-danger-quiet" onClick={() => onCancel(event._id)}>Cancel</button>
            </li>
          ))}
        </ul>
      )}
      {data.past.length > 0 && (
        <>
          <h2>Past events</h2>
          <ul className="rows">
            {data.past.map(({ _id, event }) => (
              <li key={_id}>
                <div>
                  <Link to={`/events/${event._id}`} className="row-title">{event.title}</Link>
                  <span className="muted">{fmtDate(event.startsAt)} at {event.venue}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function OrganizerView({ data }) {
  return (
    <>
      <StatStrip items={[
        { label: 'Events created', value: data.stats.events },
        { label: 'Upcoming', value: data.stats.upcoming },
        { label: 'Registrations', value: data.stats.registrations },
        { label: 'Seats filled', value: `${data.stats.fillRate}%` },
      ]} />
      <h2>Your events</h2>
      {data.events.length === 0 ? (
        <div className="empty"><h2>No events yet</h2><p>Create your first event and share it with students.</p><Link className="btn btn-primary" to="/events/new">Create event</Link></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Event</th><th>Date</th><th>Registered</th><th>Status</th><th><span className="sr">Actions</span></th></tr></thead>
            <tbody>
              {data.events.map((e) => (
                <tr key={e._id}>
                  <td><Link to={`/events/${e._id}`} className="row-title">{e.title}</Link><span className="muted block">{e.category}, {e.venue}</span></td>
                  <td>{fmtDate(e.startsAt)}</td>
                  <td>
                    <div className="meter small" aria-hidden="true"><span className="fill fill-ok" style={{ width: `${Math.min(100, (e.registeredCount / e.capacity) * 100)}%` }} /></div>
                    {e.registeredCount} / {e.capacity}
                  </td>
                  <td>{e.status === 'cancelled' ? <span className="chip chip-bad">Cancelled</span> : new Date(e.endsAt) < new Date() ? <span className="chip">Ended</span> : <span className="chip chip-good">Open</span>}</td>
                  <td className="actions-cell">
                    <Link className="btn btn-quiet" to={`/events/${e._id}/attendees`}>Attendees</Link>
                    <Link className="btn btn-quiet" to={`/events/${e._id}/edit`}>Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function AdminView({ data }) {
  const max = Math.max(1, ...data.byCategory.map((c) => c.events));
  return (
    <>
      <StatStrip items={[
        { label: 'Users', value: data.stats.users },
        { label: 'Events', value: data.stats.events },
        { label: 'Upcoming events', value: data.stats.upcoming },
        { label: 'Registrations', value: data.stats.registrations },
        { label: 'New this week', value: data.stats.recentRegistrations },
      ]} />
      <div className="two-col">
        <section>
          <h2>Events by category</h2>
          {data.byCategory.length === 0 ? <p className="muted">No events yet.</p> : (
            <ul className="bars">
              {data.byCategory.map((c) => (
                <li key={c.category}>
                  <span className="bar-label">{c.category}</span>
                  <span className="bar-track"><span className="bar-fill" style={{ width: `${(c.events / max) * 100}%` }} /></span>
                  <span className="bar-value">{c.events} <span className="muted">({c.registrations} reg.)</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2>Most popular events</h2>
          <ol className="top">
            {data.topEvents.map((e) => (
              <li key={e._id}>
                <Link to={`/events/${e._id}`} className="row-title">{e.title}</Link>
                <span className="muted">{e.registeredCount} / {e.capacity} registered</span>
              </li>
            ))}
          </ol>
          <h2>People</h2>
          <p>
            {['student', 'organizer', 'admin'].map((r) => `${data.usersByRole[r] || 0} ${r}${(data.usersByRole[r] || 0) === 1 ? '' : 's'}`).join(', ')}.
            {' '}<Link to="/admin/users">Manage users</Link>
          </p>
        </section>
      </div>
    </>
  );
}
