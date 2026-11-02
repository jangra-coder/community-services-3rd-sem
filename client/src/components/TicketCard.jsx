import { formatDateTime, formatEventWhen } from '../lib/format.js';
import { CalendarIcon, CheckCircleIcon, MapPinIcon } from './Icons.jsx';
import { Badge } from './ui.jsx';

/** The attendee's QR ticket, designed to be screenshotted on a phone. */
export default function TicketCard({ ticket, qrDataUrl }) {
  const checkedIn = ticket.status === 'checked_in';
  const cancelled = ticket.status === 'cancelled';

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-slate-200">
      <div className="bg-indigo-600 px-6 py-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">Ticket</p>
        <h2 className="mt-1 text-xl font-bold leading-snug">{ticket.event.title}</h2>
        <dl className="mt-3 space-y-1 text-sm text-indigo-100">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <dd>{formatEventWhen(ticket.event.startsAt, ticket.event.endsAt)}</dd>
          </div>
          {ticket.event.venue && (
            <div className="flex items-center gap-2">
              <MapPinIcon className="h-4 w-4 shrink-0" />
              <dd>{ticket.event.venue}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="relative px-6 py-6">
        {/* perforation */}
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-slate-50 ring-1 ring-slate-200" />
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-slate-50 ring-1 ring-slate-200" />
        <div className="mb-4 border-t border-dashed border-slate-300" />

        <div className="flex flex-col items-center text-center">
          <div className={cancelled ? 'opacity-30 grayscale' : ''}>
            <img
              src={qrDataUrl}
              alt={`QR code for ticket ${ticket.ticketCode}`}
              width={240}
              height={240}
              className="h-60 w-60 rounded-xl"
            />
          </div>
          <p className="mt-3 font-mono text-2xl font-bold tracking-widest text-slate-900">{ticket.ticketCode}</p>
          <p className="mt-1 text-sm text-slate-500">Show this code at the entrance</p>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{ticket.name}</p>
            <p className="truncate text-sm text-slate-500">{ticket.email}</p>
          </div>
          {checkedIn ? (
            <Badge tone="green" className="shrink-0 gap-1">
              <CheckCircleIcon className="h-3.5 w-3.5" /> Checked in
            </Badge>
          ) : cancelled ? (
            <Badge tone="red" className="shrink-0">
              Cancelled
            </Badge>
          ) : (
            <Badge tone="indigo" className="shrink-0">
              Registered
            </Badge>
          )}
        </div>
        {checkedIn && (
          <p className="mt-2 text-center text-xs text-slate-500">Checked in {formatDateTime(ticket.checkedInAt)}</p>
        )}
      </div>
    </div>
  );
}
