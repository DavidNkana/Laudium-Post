import {describe, expect, it, vi} from 'vitest';
import {EVENT_NAMES, announceAnalyticsConfig, deliver, sanitizeAnalyticsProperties, track, validateAnalyticsConfig} from '../src/analytics';

describe('analytics seam', () => {
  it('keeps local demo analytics observable without pretending it is durable', async () => {
    const listener = vi.fn();
    window.addEventListener('laudium:analytics', listener);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    track('advertise_cta_clicked', {path: 'directory'}, validateAnalyticsConfig(undefined, false));
    expect(listener).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
    window.removeEventListener('laudium:analytics', listener);
  });
  it('delivers the allow-listed event when a production endpoint is configured', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    expect(validateAnalyticsConfig('https://analytics.example/events', true).durable).toBe(true);
    track('search_used', {queryLength: 8, query: 'secret phrase'}, validateAnalyticsConfig('https://analytics.example/events', true));
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.properties).toEqual({queryLength: 8});
    fetchMock.mockRestore();
  });
  it('rejects an absent or insecure production endpoint', () => {
    expect(validateAnalyticsConfig(undefined, true).error).toMatch(/requires/);
    expect(validateAnalyticsConfig('http://analytics.example/events', true).error).toMatch(/HTTPS/);
  });
  it('treats omitted content mode as live production', () => {
    vi.unstubAllEnvs();
    expect(validateAnalyticsConfig(undefined).error).toMatch(/requires VITE_ANALYTICS_ENDPOINT/);
  });
  it('announces a live configuration failure only once', () => {
    const error = 'Production analytics requires VITE_ANALYTICS_ENDPOINT (an HTTPS event-ingestion endpoint).';
    const consoleMock = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const config = validateAnalyticsConfig(undefined, true);
    announceAnalyticsConfig(config);
    announceAnalyticsConfig(config);
    expect(consoleMock).toHaveBeenCalledOnce();
    expect(consoleMock).toHaveBeenCalledWith(`[analytics] ${error}`);
    consoleMock.mockRestore();
  });
  it('does not let a lone local flag bypass live analytics configuration', () => {
    vi.stubEnv('VITE_LOCAL_DEMO_MODE', 'true');
    expect(validateAnalyticsConfig(undefined, true).error).toMatch(/requires VITE_ANALYTICS_ENDPOINT/);
    vi.unstubAllEnvs();
  });
  it('never includes raw search input in analytics properties', () => {
    expect(sanitizeAnalyticsProperties('search_used', {query: 'neighbourhood', queryLength: 13})).toEqual({queryLength: 13});
  });
  it('includes navigation and WhatsApp outcome events without allowing message contents', () => {
    expect(EVENT_NAMES).toContain('sidebar_open');
    expect(EVENT_NAMES).toContain('sidebar_item_selected');
    expect(sanitizeAnalyticsProperties('advertise_whatsapp_launch', {outcome: 'success', message: 'private'})).toEqual({outcome: 'success'});
    expect(sanitizeAnalyticsProperties('advertise_cta_clicked', {path: 'header'})).toEqual({path: 'header'});
  });
  it('drops enum-invalid values before browser delivery', () => {
    expect(sanitizeAnalyticsProperties('ad_impression', {id: 'ad-1', placement: 'first-page'})).toEqual({id: 'ad-1'});
    expect(sanitizeAnalyticsProperties('ad_contact_clicked', {id: 'ad-1', contact: 'javascript'})).toEqual({id: 'ad-1'});
    expect(sanitizeAnalyticsProperties('admin_action', {action: 'drop_database'})).toEqual({});
  });
  it('records ad contact placement without accepting raw search terms', () => {
    expect(sanitizeAnalyticsProperties('ad_contact_clicked', {id: 'ad-1', placement: 'article', contact: 'Website', query: 'private'})).toEqual({id: 'ad-1', placement: 'article', contact: 'Website'});
  });
  it('requires 2xx and retries one failed delivery', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, {status: 500})).mockResolvedValueOnce(new Response(null, {status: 204}));
    const promise = deliver({name: 'ad_opened', properties: {id: 'ad-1'}, at: new Date().toISOString()}, 'https://analytics.example/events', fetcher);
    await vi.advanceTimersByTimeAsync(100);
    expect(await promise).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
