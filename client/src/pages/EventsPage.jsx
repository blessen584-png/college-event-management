import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import EventCard from '../components/EventCard.jsx';
import { ErrorNote, Loading, Pagination, useDebounced } from '../components/ui.jsx';

export default function EventsPage() {
  const { user, canManageEvents } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const f = {
    q: sp.get('q') || '',
    category: sp.get('category') || '',
    when: sp.get('when') || 'upcoming',
    available: sp.get('available') === 'true',
    sort: sp.get('sort') || '',
    from: sp.get('from') || '',
    to: sp.get('to') || '',
    page: Number(sp.get('page')) || 1,
  };

  const [searchText, setSearchText] = useState(f.q);
  const debounced = useDebounced(searchText);

  const update = (patch) => {
    const next = new URLSearchParams(sp);
    Object.entries({ page: 1, ...patch }).forEach(([k, v]) => {
      if (v === '' || v === false || v === null || (k === 'page' && v === 1) || (k === 'when' && v === 'upcoming')) next.delete(k);
      else next.set(k, String(v));
    });
    setSp(next, { replace: true });
  };

  useEffect(() => {
    if (debounced !== f.q) update({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    api('/events/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  const query = sp.toString();
  useEffect(() => {
    let live = true;
    setLoading(true);
    api('/events', { params: { q: f.q, category: f.category, when: f.when, available: f.available, sort: f.sort, from: f.from, to: f.to, page: f.page, limit: 9 } })
      .then((d) => { if (live) { setData(d); setError(''); } })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, user?._id]);

  const filtered = f.q || f.category || f.available || f.from || f.to || f.when !== 'upcoming' || f.sort;
  const clear = () => { setSearchText(''); setSp({}, { replace: true }); };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>What’s on at campus</h1>
          <p className="lede">Search by name or venue, narrow by category and date, and grab a seat before it’s gone.</p>
        </div>
        {canManageEvents && <Link to="/events/new" className="btn btn-primary">Create event</Link>}
      </div>

      <form className="filters" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="field grow">
          <label htmlFor="q">Search</label>
          <input id="q" type="search" placeholder="Hackathon, Seminar Hall, cricket…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" value={f.category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="when">Show</label>
          <select id="when" value={f.when} onChange={(e) => update({ when: e.target.value })}>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All events</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="from">From</label>
          <input id="from" type="date" value={f.from} onChange={(e) => update({ from: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" type="date" value={f.to} min={f.from || undefined} onChange={(e) => update({ to: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={f.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="">Date (default)</option>
            <option value="date_asc">Soonest first</option>
            <option value="date_desc">Latest first</option>
            <option value="popular">Most popular</option>
            <option value="newest">Recently added</option>
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={f.available} onChange={(e) => update({ available: e.target.checked })} />
          Open seats only
        </label>
        {filtered && <button type="button" className="btn btn-quiet" onClick={clear}>Clear filters</button>}
      </form>

      <ErrorNote message={error} />
      {loading && !data ? (
        <Loading label="Loading events" />
      ) : data && data.events.length === 0 ? (
        <div className="empty">
          <h2>No events match</h2>
          <p>{filtered ? 'Try a different search or clear the filters.' : 'Nothing is scheduled yet.'}</p>
          {filtered && <button className="btn btn-primary" onClick={clear}>Clear filters</button>}
        </div>
      ) : (
        data && (
          <>
            <p className="count" aria-live="polite">{data.total} {data.total === 1 ? 'event' : 'events'}</p>
            <div className={`grid ${loading ? 'dim' : ''}`}>
              {data.events.map((e) => <EventCard key={e._id} event={e} />)}
            </div>
            <Pagination page={data.page} pages={data.pages} onChange={(p) => { update({ page: p }); window.scrollTo({ top: 0 }); }} />
          </>
        )
      )}
    </div>
  );
}
