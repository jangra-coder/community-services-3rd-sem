import { Link } from 'react-router-dom';
import { formatEventWhen } from '../lib/format.js';
import AvailabilityBadge from './AvailabilityBadge.jsx';
import { CalendarIcon, MapPinIcon, UsersIcon } from './Icons.jsx';

export default function EventCard({ event }) {
  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex flex-col rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold leading-snug text-slate-900 group-hover:text-indigo-700">{event.title}</h3>
        <AvailabilityBadge event={event} />
      </div>
      <dl className="space-y-1.5 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
          <dd>{formatEventWhen(event.startsAt, event.endsAt)}</dd>
        </div>
        {event.venue && (
          <div className="flex items-center gap-2">
            <MapPinIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <dd className="truncate">{event.venue}</dd>
          </div>
        )}
        <div className="flex items-center gap-2">
          <UsersIcon className="h-4 w-4 shrink-0 text-slate-400" />
          <dd>
            {event.registrationCount} registered
            {event.capacity ? ` · ${event.capacity} seats` : ''}
          </dd>
        </div>
      </dl>
      {event.description && <p className="mt-3 line-clamp-2 text-sm text-slate-500">{event.description}</p>}
    </Link>
  );
}
