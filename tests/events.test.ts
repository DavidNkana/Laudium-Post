import {describe, expect, it, vi} from 'vitest';
import handler from '../api/events';

function response() { return {status: vi.fn().mockReturnThis(), setHeader: vi.fn().mockReturnThis(), end: vi.fn()}; }
describe('analytics ingestion endpoint', () => {
  it('rejects unknown events and raw search terms before persistence', async () => {
    const res = response();
    await handler({method: 'POST', headers: {}, body: {name: 'search_used', at: new Date().toISOString(), properties: {query: 'private'}}}, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
  it('rejects disallowed origins', async () => {
    vi.stubEnv('APP_ALLOWED_ORIGINS', 'https://news.example');
    const res = response();
    await handler({method: 'POST', headers: {origin: 'https://evil.example'}, body: {}}, res);
    expect(res.status).toHaveBeenCalledWith(403);
    vi.unstubAllEnvs();
  });
  it('requires server persistence configuration for valid events', async () => {
    const res = response();
    await handler({method: 'POST', headers: {}, body: {name: 'search_used', at: new Date().toISOString(), properties: {queryLength: 4}}}, res);
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
