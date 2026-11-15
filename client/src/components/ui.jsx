import { useEffect, useState } from 'react';

export const Loading = ({ label = 'Loading' }) => (
  <div className="loading" role="status"><span className="spinner" aria-hidden="true" /> {label}</div>
);

export const ErrorNote = ({ message }) => (message ? <div className="alert" role="alert">{message}</div> : null);

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <small className="hint">{hint}</small>}
      {error && <small className="error" id={`${htmlFor}-error`}>{error}</small>}
    </div>
  );
}

export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      <button className="btn btn-quiet" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button className="btn btn-quiet" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </nav>
  );
}

export const StatStrip = ({ items }) => (
  <dl className="stat-strip">
    {items.map((s) => (
      <div key={s.label}>
        <dd>{s.value}</dd>
        <dt>{s.label}</dt>
      </div>
    ))}
  </dl>
);

export function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
