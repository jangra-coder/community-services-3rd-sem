import { Badge } from './ui.jsx';

/** One-word summary of whether people can still register for an event. */
export default function AvailabilityBadge({ event }) {
  if (event.hasEnded) return <Badge tone="gray">Ended</Badge>;
  if (!event.registrationOpen) return <Badge tone="amber">Registration closed</Badge>;
  if (event.spotsLeft === 0) return <Badge tone="red">Full</Badge>;
  if (event.spotsLeft !== null && event.spotsLeft <= 10) return <Badge tone="amber">{event.spotsLeft} spots left</Badge>;
  return <Badge tone="green">Open</Badge>;
}
