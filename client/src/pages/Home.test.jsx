import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../lib/auth.jsx';
import Home from './Home.jsx';

const futureEvent = {
  id: 'e1',
  title: 'Blood Donation Camp',
  description: 'Annual community drive',
  venue: 'College Auditorium',
  startsAt: new Date(Date.now() + 86400000).toISOString(),
  endsAt: null,
  capacity: 100,
  registrationCount: 12,
  spotsLeft: 88,
  isPublished: true,
  registrationOpen: true,
  hasEnded: false,
  canRegister: true,
  organizerName: 'Demo Organizer',
};

function renderHome() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Home />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('<Home />', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          events: [
            futureEvent,
            { ...futureEvent, id: 'e2', title: 'Old Workshop', hasEnded: true, registrationCount: 40, capacity: null },
          ],
        }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists upcoming and past events from the API', async () => {
    renderHome();
    expect(await screen.findByText('Blood Donation Camp')).toBeInTheDocument();
    expect(screen.getByText('Old Workshop')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Past events' })).toBeInTheDocument();
    expect(screen.getByText('12 registered · 100 seats')).toBeInTheDocument();
    expect(screen.getByText('40 registered')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/events', expect.objectContaining({ method: 'GET' }));
  });

  it('links each event to its detail page', async () => {
    renderHome();
    const link = await screen.findByRole('link', { name: /Blood Donation Camp/ });
    expect(link).toHaveAttribute('href', '/events/e1');
  });
});
