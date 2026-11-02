import { Link } from 'react-router-dom';
import { cx } from '../lib/cx.js';
import { AlertIcon, ArrowLeftIcon, CheckCircleIcon } from './Icons.jsx';

const buttonVariants = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500 shadow-xs',
  secondary: 'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:ring-indigo-500',
  ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:ring-indigo-500',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500',
};

const buttonSizes = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-5 text-base gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  className,
  children,
  to,
  type = 'button',
  disabled,
  ...props
}) {
  const classes = cx(
    'inline-flex items-center justify-center whitespace-nowrap rounded-xl font-semibold transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
    buttonVariants[variant],
    buttonSizes[size],
    block && 'w-full',
    className,
  );
  const content = (
    <>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={classes} aria-disabled={disabled} {...props}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
}

const inputBase =
  'block w-full rounded-xl border-0 bg-white px-3.5 py-3 text-base text-slate-900 shadow-xs ring-1 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:outline-hidden disabled:bg-slate-50 disabled:text-slate-500';

export function Input({ className, invalid, ...props }) {
  return (
    <input
      className={cx(inputBase, invalid ? 'ring-red-400 focus:ring-red-500' : 'ring-slate-300 focus:ring-indigo-600', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Textarea({ className, invalid, ...props }) {
  return (
    <textarea
      className={cx(inputBase, 'min-h-28', invalid ? 'ring-red-400 focus:ring-red-500' : 'ring-slate-300 focus:ring-indigo-600', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cx(inputBase, 'ring-slate-300 focus:ring-indigo-600', className)} {...props}>
      {children}
    </select>
  );
}

export function Field({ label, htmlFor, hint, error, optional, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Toggle({ label, description, checked, onChange, name }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-slate-500">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          name={name}
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-indigo-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cx('rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200', className)} {...props}>
      {children}
    </div>
  );
}

const badgeTones = {
  gray: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  indigo: 'bg-indigo-100 text-indigo-800',
};

export function Badge({ tone = 'gray', className, children }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function Spinner({ className = 'h-6 w-6' }) {
  return (
    <svg className={cx('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500" role="status">
      <Spinner className="h-8 w-8 text-indigo-600" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

const alertTones = {
  error: { wrap: 'bg-red-50 text-red-800 ring-red-200', Icon: AlertIcon },
  success: { wrap: 'bg-emerald-50 text-emerald-800 ring-emerald-200', Icon: CheckCircleIcon },
  info: { wrap: 'bg-indigo-50 text-indigo-800 ring-indigo-200', Icon: AlertIcon },
  warning: { wrap: 'bg-amber-50 text-amber-800 ring-amber-200', Icon: AlertIcon },
};

export function Alert({ tone = 'info', title, children, className }) {
  const { wrap, Icon } = alertTones[tone];
  return (
    <div className={cx('flex gap-3 rounded-xl p-4 text-sm ring-1', wrap, className)} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      {Icon && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, back, actions, children }) {
  return (
    <div className="mb-6">
      {back && (
        <Link to={back.to} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeftIcon className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint, tone = 'indigo' }) {
  const tones = {
    indigo: 'text-indigo-600',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    gray: 'text-slate-700',
  };
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cx('mt-1 text-3xl font-bold tabular-nums', tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}
