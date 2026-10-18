import {describe, expect, it} from 'vitest';
import {adQueries, articleQueries, AppwriteContentAdapter, DemoContentAdapter, TablesDbReader, contentAdapter, filterLiveAds, listAllAds, listAllPlacementAds, resolveContentMode, serializeStructuredValue, toAd, toArticle} from '../src/adapter';
import {requiredPublicIndexes, verifySearchIndexes} from '../src/appwriteSetup';

describe('content adapter configuration', () => {
  it('requires both explicit demo flags and otherwise resolves to live Appwrite mode', () => {
    expect(resolveContentMode('demo', 'true')).toBe('demo');
    expect(resolveContentMode('demo', undefined)).toBe('appwrite');
    expect(resolveContentMode('demo', 'false')).toBe('appwrite');
    expect(resolveContentMode(undefined, 'true')).toBe('appwrite');
    expect(resolveContentMode('appwrite', 'true')).toBe('appwrite');
  });
  it('fails loudly instead of returning demo fixtures when Appwrite is unconfigured', () => {
    expect(() => new AppwriteContentAdapter()).toThrow(/configuration is missing/);
  });
  it('keeps demo pagination explicit and local', async () => {
    const result = await new DemoContentAdapter().listArticles('', '', {limit: 1});
    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.items[0].status).toBe('Published');
  });
  it('never turns an unconfigured default into demo fixtures', async () => {
    await expect(contentAdapter.listArticles()).rejects.toThrow(/configuration is missing/);
  });
  it('hydrates records outside the first demo page for deep links', async () => {
    const adapter = new DemoContentAdapter();
    expect((await adapter.getArticle('field-notes'))?.title).toBe('A field guide to the Sunday game');
    expect((await adapter.getAd('page-turner'))?.business).toBe('Page Turner Books');
    expect((await adapter.getAd('page-turner'))?.contacts).toEqual({website: 'https://example.com/page-turner'});
  });
  it('excludes missing, malformed, future, and expired ads at the client boundary', () => {
    const now = new Date('2026-10-16T12:00:00.000Z');
    const base = {status: 'Approved', active: true};
    const live = {...base, startsAt: '2026-10-16T11:00:00.000Z', endsAt: '2026-10-16T13:00:00.000Z'};
    expect(filterLiveAds([{...live, $id: 'live'}, {...base, $id: 'missing'}, {...live, $id: 'future', startsAt: '2026-10-16T13:00:01.000Z'}, {...live, $id: 'bad', endsAt: 'not-a-date'}], now).map(x => x.$id)).toEqual(['live']);
  });
  it('adds a real placement constraint to public ad queries', () => {
    expect(adQueries('', 2, undefined, new Date('2026-10-16T12:00:00.000Z'), 'community')).toContain('{"method":"contains","attribute":"placements","values":["community"]}');
  });
  it('walks every placement page so later eligible ads can rotate', async () => {
    const calls: Array<{cursor?: string; placement?: string}> = [];
    const result = await listAllAds({listAds: async (_search, options, placement) => {
      calls.push({cursor: options?.cursor, placement});
      return options?.cursor ? {items: [{id: 'later'} as any], nextCursor: undefined, hasMore: false} : {items: [{id: 'first'} as any], nextCursor: 'page-2', hasMore: true};
    }}, 'home-top');
    expect(result.map(ad => ad.id)).toEqual(['first', 'later']);
    expect(calls).toEqual([{placement: 'home-top'}, {cursor: 'page-2', placement: 'home-top'}]);
  });
  it('merges exhaustive placement inventory without dropping later-page ads', async () => {
    const result = await listAllPlacementAds({listAds: async (_search, options, placement) => {
      if (placement === 'home-top') return options?.cursor ? {items: [{id: 'top-later'} as any], nextCursor: undefined, hasMore: false} : {items: [{id: 'shared'} as any], nextCursor: 'page-2', hasMore: true};
      return {items: [{id: 'shared'} as any, {id: 'section-only'} as any], nextCursor: undefined, hasMore: false};
    }}, ['home-top', 'section']);
    expect(result.map(ad => ad.id)).toEqual(['shared', 'top-later', 'section-only']);
  });
  it('uses inclusive live bounds and a unique id tie-breaker for stable cursor pages', () => {
    const queries = adQueries('', 2, 'page-1', new Date('2026-10-16T12:00:00.000Z'));
    expect(queries).toEqual(expect.arrayContaining([
      '{"method":"equal","attribute":"status","values":["Approved"]}', '{"method":"equal","attribute":"active","values":[true]}',
      '{"method":"lessThanEqual","attribute":"startsAt","values":["2026-10-16T12:00:00.000Z"]}', '{"method":"greaterThanEqual","attribute":"endsAt","values":["2026-10-16T12:00:00.000Z"]}',
      '{"method":"orderDesc","attribute":"startsAt"}', '{"method":"orderDesc","attribute":"$id"}', '{"method":"cursorAfter","values":["page-1"]}', '{"method":"limit","values":[2]}',
    ]));
  });
  it('keeps article page boundaries on the same deterministic order', () => {
    const firstPage = articleQueries('', '', 2);
    const secondPage = articleQueries('', '', 2, 'article-2');
    expect(firstPage).toEqual(expect.arrayContaining(['{"method":"orderDesc","attribute":"publishedAt"}', '{"method":"orderDesc","attribute":"$id"}']));
    expect(secondPage).toEqual(expect.arrayContaining(['{"method":"orderDesc","attribute":"publishedAt"}', '{"method":"orderDesc","attribute":"$id"}', '{"method":"cursorAfter","values":["article-2"]}']));
  });
  it('verifies every Query.search field has a provisioned full-text index', () => {
    expect(verifySearchIndexes(requiredPublicIndexes)).toBe(true);
    expect(verifySearchIndexes(requiredPublicIndexes.filter(index => index.key !== 'ads_category_search'))).toBe(false);
  });
  it('maps JSON strings from Appwrite longtext fields into typed values', () => {
    const ad = toAd({$id: 'ad', media: '{"url":"https://example.com/ad.png","type":"image","width":1200,"height":800}', contacts: '{"website":"https://example.com"}'});
    expect(ad.media).toEqual({url: 'https://example.com/ad.png', type: 'image', width: 1200, height: 800});
    expect(ad.contacts).toEqual({website: 'https://example.com'});
    expect(toArticle({$id: 'article', body: '["First paragraph","Second paragraph"]', publishedAt: '2026-10-16T00:00:00.000Z'}).body).toEqual(['First paragraph', 'Second paragraph']);
    expect(serializeStructuredValue({website: 'https://example.com'})).toBe('{"website":"https://example.com"}');
  });
  it('fails closed for malformed structured JSON', () => {
    const ad = toAd({$id: 'ad', media: '{not-json', contacts: '["not-an-object"]'});
    expect(ad.media).toBeUndefined();
    expect(ad.contacts).toBeUndefined();
    expect(toArticle({$id: 'article', body: '{not-json', publishedAt: '2026-10-16T00:00:00.000Z'}).body).toEqual([]);
  });
  it('reads TablesDB rows, not legacy collection documents, with encoded queries and row paths', async () => {
    const calls: Array<{url: string; headers?: Headers}> = [];
    const reader = new TablesDbReader('https://fra.cloud.appwrite.io/v1', 'project', 'laudium_post', async (input, init) => {
      const url = String(input);
      calls.push({url, headers: init?.headers as Headers});
      const adRow = {$id: 'ad-row', media: '{"url":"https://example.com/ad.png","type":"image","width":1200,"height":800}', contacts: '{"website":"https://example.com"}'};
      const payload = url.endsWith('/row-1') ? {$id: 'row-1', title: 'A row'} : url.includes('/public_ads/') ? {rows: [adRow], total: 1} : {rows: [{$id: 'row-1', title: 'A row'}], total: 1};
      return new Response(JSON.stringify(payload), {status: 200, headers: {'Content-Type': 'application/json'}});
    });
    const result = await reader.listRows('public_articles', ['{"method":"limit","values":[6]}']);
    const row = await reader.getRow('public_articles', 'row-1');
    const adRows = await reader.listRows('public_ads');
    expect(result.rows?.[0].$id).toBe('row-1');
    expect(row.$id).toBe('row-1');
    expect(toAd(adRows.rows![0]).media?.url).toBe('https://example.com/ad.png');
    expect(toAd(adRows.rows![0]).contacts).toEqual({website: 'https://example.com'});
    expect(calls[0].url).toContain('/v1/tablesdb/laudium_post/tables/public_articles/rows?queries%5B%5D=');
    expect(calls[1].url).toBe('https://fra.cloud.appwrite.io/v1/tablesdb/laudium_post/tables/public_articles/rows/row-1');
    expect(calls[0].headers?.['X-Appwrite-Project']).toBe('project');
    expect(calls.map(call => call.url).join(' ')).not.toContain('/collections/');
  });
});
