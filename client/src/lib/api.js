const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const TOKEN_KEY = 'eventpass.token';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code;
    this.details = body?.details;
    this.body = body;
  }

  /** `{ fieldName: 'message' }` built from validation details. */
  get fieldErrors() {
    const out = {};
    for (const d of this.details || []) {
      if (d.path && !out[d.path]) out[d.path] = d.message;
    }
    return out;
  }
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* private mode – the session simply will not persist */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export async function request(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const token = tokenStore.get();
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (raw) {
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return res;
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

const qs = (params) => {
  const clean = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '' && v !== null);
  return clean.length ? `?${new URLSearchParams(clean)}` : '';
};

export const api = {
  auth: {
    signup: (body) => request('/auth/signup', { method: 'POST', body }),
    login: (body) => request('/auth/login', { method: 'POST', body }),
    me: () => request('/auth/me'),
  },
  events: {
    list: () => request('/events'),
    mine: () => request('/events/mine'),
    get: (id) => request(`/events/${id}`),
    create: (body) => request('/events', { method: 'POST', body }),
    update: (id, body) => request(`/events/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/events/${id}`, { method: 'DELETE' }),
    stats: (id) => request(`/events/${id}/stats`),
    registrations: (id, params) => request(`/events/${id}/registrations${qs(params)}`),
    exportCsv: (id) => request(`/events/${id}/registrations/export`, { raw: true }),
    cancelRegistration: (id, registrationId) =>
      request(`/events/${id}/registrations/${registrationId}`, { method: 'DELETE' }),
    register: (id, body) => request(`/events/${id}/register`, { method: 'POST', body }),
    resendTicket: (id, email) => request(`/events/${id}/resend-ticket`, { method: 'POST', body: { email } }),
    checkin: (id, code) => request(`/events/${id}/checkin`, { method: 'POST', body: { code } }),
    undoCheckin: (id, code) => request(`/events/${id}/checkin/${encodeURIComponent(code)}`, { method: 'DELETE' }),
  },
  tickets: {
    get: (code) => request(`/tickets/${encodeURIComponent(code)}`),
  },
};

/** Fetch the CSV export (needs the auth header) and trigger a browser download. */
export async function downloadRegistrationsCsv(eventId, filename = 'registrations.csv') {
  const res = await api.events.exportCsv(eventId);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
