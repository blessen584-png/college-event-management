import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../toast.jsx';
import { ErrorNote, Loading, Pagination, useDebounced } from '../components/ui.jsx';
import { fmtDate } from '../format.js';

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const dq = useDebounced(q);

  const load = useCallback(
    () => api('/admin/users', { params: { q: dq, role, page, limit: 10 } }).then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)),
    [dq, role, page]
  );
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [dq, role]);

  const changeRole = async (u, next) => {
    try {
      await api(`/admin/users/${u._id}/role`, { method: 'PATCH', body: { role: next } });
      toast(`${u.name} is now ${next === 'admin' ? 'an admin' : `a${next === 'organizer' ? 'n' : ''} ${next}`}.`);
      load();
    } catch (e) { toast(e.message, 'bad'); }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete ${u.name}? Their registrations and any events they organised will be removed.`)) return;
    try {
      await api(`/admin/users/${u._id}`, { method: 'DELETE' });
      toast('User deleted.');
      load();
    } catch (e) { toast(e.message, 'bad'); }
  };

  return (
    <div className="page">
      <div className="page-head"><div><h1>Users</h1><p className="lede">Change roles or remove accounts.</p></div></div>
      <div className="filters">
        <div className="field grow">
          <label htmlFor="uq">Search</label>
          <input id="uq" type="search" placeholder="Name, email or department" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="urole">Role</label>
          <select id="urole" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option><option value="student">Students</option><option value="organizer">Organizers</option><option value="admin">Admins</option>
          </select>
        </div>
      </div>
      <ErrorNote message={error} />
      {!data ? <Loading /> : data.users.length === 0 ? (
        <div className="empty"><h2>No users found</h2><p>Try a different search.</p></div>
      ) : (
        <>
          <p className="count">{data.total} {data.total === 1 ? 'user' : 'users'}</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Joined</th><th>Role</th><th><span className="sr">Actions</span></th></tr></thead>
              <tbody>
                {data.users.map((u) => {
                  const self = u._id === me._id;
                  return (
                    <tr key={u._id}>
                      <td>{u.name}{self && <span className="muted"> (you)</span>}</td>
                      <td>{u.email}</td>
                      <td>{u.department || '-'}</td>
                      <td>{fmtDate(u.createdAt)}</td>
                      <td>
                        <select aria-label={`Role for ${u.name}`} value={u.role} disabled={self} onChange={(e) => changeRole(u, e.target.value)}>
                          <option value="student">student</option><option value="organizer">organizer</option><option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="actions-cell"><button className="btn btn-danger-quiet" disabled={self} onClick={() => remove(u)}>Delete</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
