import {describe, expect, it, vi} from 'vitest';
import {sanitizeAnalyticsProperties, track, validateAnalyticsConfig} from '../src/analytics';

describe('analytics seam', () => {
  it('keeps local demo analytics observable without pretending it is durable', async () => {
    const listener = vi.fn();
    window.addEventListener('laudium:analytics', listener);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    track('advertise_cta_clicked', {path: 'directory'});
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
  it('never includes raw search input in analytics properties', () => {
    expect(sanitizeAnalyticsProperties('search_used', {query: 'neighbourhood', queryLength: 13})).toEqual({queryLength: 13});
  });
});
