import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ErrorNote, Field } from '../components/ui.jsx';

function useAuthForm(action) {
  const navigate = useNavigate();
  const location = useLocation();
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (body, validate) => {
    const local = validate ? validate(body) : {};
    setErrors(local);
    setFormError('');
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      await action(body);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (e) {
      setErrors(e.errors || {});
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return { errors, formError, busy, submit };
}

export function LoginPage() {
  const { login } = useAuth();
  const { errors, formError, busy, submit } = useAuthForm(login);
  const [form, setForm] = useState({ email: '', password: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const fill = (email, password) => setForm({ email, password });

  return (
    <div className="page auth">
      <h1>Log in</h1>
      <ErrorNote message={formError} />
      <form className="form" noValidate onSubmit={(e) => { e.preventDefault(); submit(form, (b) => ({ ...(b.email ? {} : { email: 'Enter your email.' }), ...(b.password ? {} : { password: 'Enter your password.' }) })); }}>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <input id="password" type="password" autoComplete="current-password" value={form.password} onChange={set('password')} />
        </Field>
        <button className="btn btn-primary block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="alt">New here? <Link to="/register">Create an account</Link></p>
      <div className="demo">
        <strong>Try a demo account</strong>
        <button type="button" onClick={() => fill('student@college.edu', 'Student@123')}>Student</button>
        <button type="button" onClick={() => fill('organizer@college.edu', 'Organizer@123')}>Organizer</button>
        <button type="button" onClick={() => fill('admin@college.edu', 'Admin@123')}>Admin</button>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const { errors, formError, busy, submit } = useAuthForm(register);
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '', role: 'student' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const validate = (b) => {
    const e = {};
    if (b.name.trim().length < 2) e.name = 'Enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) e.email = 'Enter a valid email address.';
    if (b.password.length < 6) e.password = 'Use at least 6 characters.';
    return e;
  };

  return (
    <div className="page auth">
      <h1>Create your account</h1>
      <ErrorNote message={formError} />
      <form className="form" noValidate onSubmit={(e) => { e.preventDefault(); submit(form, validate); }}>
        <Field label="Full name" htmlFor="name" error={errors.name}>
          <input id="name" autoComplete="name" value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} hint="At least 6 characters">
          <input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Department or course" htmlFor="department" error={errors.department}>
          <input id="department" value={form.department} onChange={set('department')} placeholder="MCA, B.Tech CSE…" />
        </Field>
        <fieldset className="choice">
          <legend>I’m joining as</legend>
          <label><input type="radio" name="role" value="student" checked={form.role === 'student'} onChange={set('role')} /> A student looking for events</label>
          <label><input type="radio" name="role" value="organizer" checked={form.role === 'organizer'} onChange={set('role')} /> An organizer creating events</label>
        </fieldset>
        <button className="btn btn-primary block" disabled={busy}>{busy ? 'Creating account…' : 'Sign up'}</button>
      </form>
      <p className="alt">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
