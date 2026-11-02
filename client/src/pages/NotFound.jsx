import { Button } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-6xl font-black text-slate-200">404</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">The link may be broken or the page may have moved.</p>
      <Button to="/" className="mt-6">
        Go to events
      </Button>
    </div>
  );
}
