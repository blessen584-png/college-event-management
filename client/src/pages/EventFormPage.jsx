import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../toast.jsx';
import { ErrorNote, Field, Loading } from '../components/ui.jsx';
import { toLocalInput } from '../format.js';

const blank = () => {
  const start = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 2 * 3600 * 1000);
  return { title: '', description: '', category: 'Technical', venue: '', startsAt: toLocalInput(start), endsAt: toLocalInput(end), capacity: 50 };
};

export default function EventFormPage() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(blank);
  const [categories, setCategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/events/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editing) return;
    api(`/events/${id}`)
      .then(({ event }) => {
        if (!event.canManage) { setFormError('Only the organizer or an admin can edit this event.'); return; }
        setForm({
          title: event.title, description: event.description, category: event.category, venue: event.venue,
          startsAt: toLocalInput(event.startsAt), endsAt: toLocalInput(event.endsAt), capacity: event.capacity,
        });
      })
      .catch((e) => setFormError(e.message))
      .finally(() => setLoading(false));
  }, [editing, id]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (form.title.trim().length < 3) local.title = 'Title must be at least 3 characters.';
    if (!form.description.trim()) local.description = 'Add a short description.';
    if (!form.venue.trim()) local.venue = 'Enter the venue.';
    if (!form.startsAt) local.startsAt = 'Choose a start time.';
    if (!form.endsAt) local.endsAt = 'Choose an end time.';
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) local.endsAt = 'End time must be after the start time.';
    if (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1) local.capacity = 'Capacity must be a whole number, at least 1.';
    setErrors(local);
    if (Object.keys(local).length) return;

    setSaving(true);
    setFormError('');
    try {
      const body = {
        ...form,
        capacity: Number(form.capacity),
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
      };
      const res = editing
        ? await api(`/events/${id}`, { method: 'PUT', body })
        : await api('/events', { method: 'POST', body });
      toast(editing ? 'Event updated.' : 'Event created.');
      navigate(`/events/${res.event._id}`);
    } catch (err) {
      setErrors(err.errors || {});
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="page narrow">
      <Link to={editing ? `/events/${id}` : '/'} className="back">Back</Link>
      <h1>{editing ? 'Edit event' : 'Create an event'}</h1>
      <ErrorNote message={formError} />
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Title" htmlFor="title" error={errors.title}>
          <input id="title" value={form.title} onChange={set('title')} maxLength={120} aria-invalid={!!errors.title} />
        </Field>
        <div className="row">
          <Field label="Category" htmlFor="category" error={errors.category}>
            <select id="category" value={form.category} onChange={set('category')}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Capacity" htmlFor="capacity" error={errors.capacity} hint="Maximum number of attendees">
            <input id="capacity" type="number" min="1" value={form.capacity} onChange={set('capacity')} aria-invalid={!!errors.capacity} />
          </Field>
        </div>
        <Field label="Venue" htmlFor="venue" error={errors.venue}>
          <input id="venue" value={form.venue} onChange={set('venue')} maxLength={120} aria-invalid={!!errors.venue} />
        </Field>
        <div className="row">
          <Field label="Starts" htmlFor="startsAt" error={errors.startsAt}>
            <input id="startsAt" type="datetime-local" value={form.startsAt} onChange={set('startsAt')} aria-invalid={!!errors.startsAt} />
          </Field>
          <Field label="Ends" htmlFor="endsAt" error={errors.endsAt}>
            <input id="endsAt" type="datetime-local" value={form.endsAt} min={form.startsAt} onChange={set('endsAt')} aria-invalid={!!errors.endsAt} />
          </Field>
        </div>
        <Field label="Description" htmlFor="description" error={errors.description} hint="What will happen, who it’s for, what to bring">
          <textarea id="description" rows="6" value={form.description} onChange={set('description')} maxLength={3000} aria-invalid={!!errors.description} />
        </Field>
        <div className="actions">
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create event'}</button>
          <Link className="btn btn-quiet" to={editing ? `/events/${id}` : '/'}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}
