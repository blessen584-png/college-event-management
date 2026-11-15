import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../toast.jsx';
import { ErrorNote, Loading } from '../components/ui.jsx';
import { fmtDate, fmtTime } from '../format.js';

export default function AttendeesPage() {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    api(`/events/${id}/attendees`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.attendees.filter((a) => !needle || `${a.user.name} ${a.user.email} ${a.user.department}`.toLowerCase().includes(needle));
  }, [data, q]);

  const download = async () => {
    try {
      const blob = await api(`/events/${id}/attendees.csv`, { blob: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendees-${data.event.title.replace(/\W+/g, '-').toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(e.message, 'bad');
    }
  };

  if (error) return <div className="page narrow"><ErrorNote message={error} /></div>;
  if (!data) return <Loading />;

  return (
    <div className="page">
      <Link to={`/events/${id}`} className="back">Back to event</Link>
      <div className="page-head">
        <div>
          <h1>Attendees</h1>
          <p className="lede">{data.event.title}: {data.event.registeredCount} of {data.event.capacity} seats taken</p>
        </div>
        <button className="btn btn-primary" onClick={download} disabled={!data.attendees.length}>Download CSV</button>
      </div>
      {data.attendees.length === 0 ? (
        <div className="empty"><h2>No registrations yet</h2><p>Share the event link to get people signed up.</p></div>
      ) : (
        <>
          <div className="field" style={{ maxWidth: 360 }}>
            <label htmlFor="aq">Filter attendees</label>
            <input id="aq" type="search" placeholder="Name, email or department" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Registered</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a._id}>
                    <td>{a.user.name}</td><td>{a.user.email}</td><td>{a.user.department || '-'}</td>
                    <td>{fmtDate(a.registeredAt)}, {fmtTime(a.registeredAt)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan="4" className="muted">No attendee matches “{q}”.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
