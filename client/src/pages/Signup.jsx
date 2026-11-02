import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Alert, Button, Field, Input } from '../components/ui.jsx';

export default function Signup() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', signupCode: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/organizer" replace />;

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signup({ ...form, signupCode: form.signupCode || undefined });
      navigate('/organizer', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION') setFieldErrors(err.fieldErrors);
      else setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold text-slate-900">Create an organizer account</h1>
      <p className="mt-1 text-sm text-slate-500">Publish events, email QR tickets and check attendees in from your phone.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Your name" htmlFor="name" error={fieldErrors.name}>
          <Input id="name" autoComplete="name" required autoFocus value={form.name} onChange={update('name')} invalid={Boolean(fieldErrors.name)} />
        </Field>
        <Field label="Email" htmlFor="email" error={fieldErrors.email}>
          <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={update('email')} invalid={Boolean(fieldErrors.email)} />
        </Field>
        <Field label="Password" htmlFor="password" error={fieldErrors.password} hint="At least 8 characters.">
          <Input id="password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={update('password')} invalid={Boolean(fieldErrors.password)} />
        </Field>
        <Field label="Sign-up code" htmlFor="signupCode" optional hint="Only needed if your institution restricts who can organise events.">
          <Input id="signupCode" autoComplete="off" value={form.signupCode} onChange={update('signupCode')} />
        </Field>
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="submit" size="lg" block loading={submitting}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
