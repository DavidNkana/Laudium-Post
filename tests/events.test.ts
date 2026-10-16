import {describe, expect, it, vi} from 'vitest';
vi.mock('appwrite', () => ({Client: class {setEndpoint() {return this} setProject() {return this} setKey() {return this}}, Databases: class {createDocument = vi.fn().mockResolvedValue({})}, ID: {unique: () => 'event-id'}}));
import handler from '../api/events';

function response() { return {status: vi.fn().mockReturnThis(), setHeader: vi.fn().mockReturnThis(), end: vi.fn()}; }
describe('analytics ingestion endpoint', () => {
  it.each([
    ['sidebar_open', {}],
    ['sidebar_item_selected', {item: 'Search'}],
    ['advertise_whatsapp_launch', {outcome: 'success'}],
    ['ad_impression', {id: 'ad-1', placement: 'home-top'}],
    ['ad_rotated', {id: 'ad-2', placement: 'section'}],
    ['ad_contact_clicked', {id: 'ad-1', contact: 'WhatsApp'}],
    ['ad_reported', {id: 'ad-1'}],
  ])('accepts the documented %s event properties', async (name, properties) => {
    vi.stubEnv('APPWRITE_API_KEY', 'test'); vi.stubEnv('APPWRITE_ENDPOINT', 'https://appwrite.example'); vi.stubEnv('APPWRITE_PROJECT_ID', 'project'); vi.stubEnv('APPWRITE_DATABASE_ID', 'database'); vi.stubEnv('APPWRITE_ANALYTICS_COLLECTION_ID', 'events');
    const res = response();
    await handler({method: 'POST', headers: {}, body: {name, at: new Date().toISOString(), properties}}, res);
    expect(res.status).toHaveBeenCalledWith(202);
    vi.unstubAllEnvs();
  });
  it.each([
    ['sidebar_open', {source: 'mobile'}],
    ['sidebar_item_selected', {label: 'Search'}],
    ['advertise_whatsapp_launch', {message: 'private'}],
  ])('rejects undocumented properties for %s', async (name, properties) => {
    const res = response();
    await handler({method: 'POST', headers: {}, body: {name, at: new Date().toISOString(), properties}}, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
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
