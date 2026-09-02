import { describe, it, expect } from 'vitest';
import { app } from '../src/app.js';

describe('CORS Middleware Configuration', () => {
  it('should include CORS headers on OPTIONS preflight requests', async () => {
    const res = await app.request('/health', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('should include CORS headers on GET requests', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: {
        'Origin': 'https://example.com',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('should include CORS headers on API v1 routes', async () => {
    const res = await app.request('/api/v1/health', {
      method: 'GET',
      headers: {
        'Origin': 'https://example.com',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
