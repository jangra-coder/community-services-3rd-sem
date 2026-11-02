import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import TicketCard from '../components/TicketCard.jsx';
import { DownloadIcon, ShareIcon } from '../components/Icons.jsx';
import { Alert, Button, PageLoader } from '../components/ui.jsx';

export default function TicketPage() {
  const { code } = useParams();
  const location = useLocation();
  const initial = location.state?.ticket?.ticketCode === code ? location.state : null;

  const [data, setData] = useState(initial);
  const [error, setError] = useState(null);
  const justRegistered = Boolean(initial?.justRegistered);
  // The registration response carries the full email; later polls only have the masked one.
  const [registeredEmail] = useState(initial?.ticket?.email ?? null);

  const load = useCallback(async () => {
    try {
      const fresh = await api.tickets.get(code);
      setData((prev) => ({ ...prev, ...fresh }));
      setError(null);
    } catch (err) {
      setError(err.status === 404 ? 'We could not find a ticket with this code.' : err.message);
    }
  }, [code]);

  // Load on arrival (unless we just registered) and keep the status fresh
  // so the attendee sees "Checked in" as soon as they pass the entrance.
  const hadInitial = useRef(Boolean(initial));
  useEffect(() => {
    if (!hadInitial.current) load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Ticket · ${data.ticket.event.title}`, url });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard?.writeText(url);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-md">
        <Alert tone="error" title="Ticket not found">
          {error}
        </Alert>
        <Button to="/" variant="secondary" className="mt-4">
          Browse events
        </Button>
      </div>
    );
  }
  if (!data) return <PageLoader label="Loading your ticket…" />;

  return (
    <div className="mx-auto max-w-md animate-rise">
      {justRegistered && (
        <Alert tone="success" title="You're registered!" className="mb-5">
          We've emailed this ticket to <strong>{registeredEmail || data.ticket.email}</strong>. Save a screenshot too, just in case.
        </Alert>
      )}

      <TicketCard ticket={data.ticket} qrDataUrl={data.qrDataUrl} />

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => downloadDataUrl(data.qrDataUrl, `ticket-${data.ticket.ticketCode}.png`)}>
          <DownloadIcon className="h-4 w-4" /> Save QR
        </Button>
        <Button variant="secondary" onClick={share}>
          <ShareIcon className="h-4 w-4" /> Share
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-slate-500">
        Keep this page open or add it to your home screen for quick access at the venue.
      </p>
    </div>
  );
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
