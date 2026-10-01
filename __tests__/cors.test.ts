import { describe, it, expect } from 'vitest';
import { app } from '../src/app.js';

describe('CORS Middleware Configuration', () => {
  it('should include CORS headers for an allowed origin on OPTIONS preflight requests', async () => {
    const res = await app.request('/health', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(res.headers.get('access-control-allow-methods')).toContain('GET');
    expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type');
  });

  it('should include CORS headers for trusted domain on GET requests', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: {
        'Origin': 'https://kya-service.duckdns.org',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://kya-service.duckdns.org');
  });

  it('should NOT allow untrusted origin on GET or OPTIONS requests', async () => {
    const resGet = await app.request('/health', {
      method: 'GET',
      headers: {
        'Origin': 'https://malicious-site.com',
      },
    });

    expect(resGet.headers.get('access-control-allow-origin')).toBeNull();

    const resOptions = await app.request('/health', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://malicious-site.com',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(resOptions.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('should allow headers like X-Payment and Content-Type on API v1 routes', async () => {
    const res = await app.request('/api/v1/health', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, X-Payment',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(res.headers.get('access-control-allow-headers')).toContain('X-Payment');
  });
});
