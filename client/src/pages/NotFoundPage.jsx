import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="page narrow">
      <div className="empty">
        <h2>That page doesn’t exist</h2>
        <p>The link may be old or mistyped.</p>
        <Link className="btn btn-primary" to="/">See upcoming events</Link>
      </div>
    </div>
  );
}
