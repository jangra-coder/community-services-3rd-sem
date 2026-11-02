import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * config.js reads process.env once at import time, so every case re-imports
 * it with a fresh module registry.
 */
async function loadConfigWith(overrides) {
  vi.resetModules();
  const saved = { ...process.env };
  Object.assign(process.env, { DATABASE_URL: 'postgres://example/db' }, overrides);
  try {
    return (await import('../src/config.js')).config;
  } finally {
    process.env = saved;
  }
}

const STRONG = 'c6c2d1f4e8a94b7e9f0d3a5b7c9e1f2a4b6d8e0f1a3c5e7b9d1f3a5c7e9b1d3f';

describe('config – JWT_SECRET guard', () => {
  afterEach(() => vi.resetModules());

  it('rejects every known placeholder secret in production', async () => {
    for (const secret of [
      'change-me-in-production',
      'please-change-this-secret-before-going-live',
      'dev-only-insecure-secret',
      'test-secret-not-for-production',
    ]) {
      await expect(loadConfigWith({ NODE_ENV: 'production', JWT_SECRET: secret })).rejects.toThrow(/JWT_SECRET/);
    }
  });

  it('rejects a missing or short secret in production', async () => {
    await expect(loadConfigWith({ NODE_ENV: 'production', JWT_SECRET: '' })).rejects.toThrow(/JWT_SECRET/);
    await expect(loadConfigWith({ NODE_ENV: 'production', JWT_SECRET: 'short-secret' })).rejects.toThrow(/JWT_SECRET/);
  });

  it('accepts a strong secret in production', async () => {
    const config = await loadConfigWith({ NODE_ENV: 'production', JWT_SECRET: STRONG });
    expect(config.jwtSecret).toBe(STRONG);
    expect(config.isProduction).toBe(true);
  });

  it('falls back to a development secret outside production', async () => {
    const config = await loadConfigWith({ NODE_ENV: 'development', JWT_SECRET: '' });
    expect(config.jwtSecret).toBe('dev-only-insecure-secret');
  });

  it('derives the public URL from the hosting platform when CLIENT_URL is unset', async () => {
    const render = await loadConfigWith({ CLIENT_URL: '', RENDER_EXTERNAL_URL: 'https://eventpass.onrender.com/' });
    expect(render.clientUrl).toBe('https://eventpass.onrender.com');

    const railway = await loadConfigWith({ CLIENT_URL: '', RAILWAY_PUBLIC_DOMAIN: 'eventpass.up.railway.app' });
    expect(railway.clientUrl).toBe('https://eventpass.up.railway.app');

    const explicit = await loadConfigWith({ CLIENT_URL: 'https://events.example.edu', RENDER_EXTERNAL_URL: 'https://x' });
    expect(explicit.clientUrl).toBe('https://events.example.edu');
  });
});
