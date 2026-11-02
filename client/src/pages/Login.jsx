import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Alert, Button, Field, Input } from '../components/ui.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/organizer';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold text-slate-900">Organizer login</h1>
      <p className="mt-1 text-sm text-slate-500">Manage your events, scan tickets and watch attendance live.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" block loading={submitting}>
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        New organizer?{' '}
        <Link to="/signup" className="font-semibold text-indigo-600 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
