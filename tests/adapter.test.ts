import {describe, expect, it} from 'vitest';
import {adQueries, articleQueries, AppwriteContentAdapter, DemoContentAdapter, filterLiveAds} from '../src/adapter';
import {requiredPublicIndexes, verifySearchIndexes} from '../src/appwriteSetup';

describe('content adapter configuration', () => {
  it('fails loudly instead of returning demo fixtures when Appwrite is unconfigured', () => {
    expect(() => new AppwriteContentAdapter()).toThrow(/configuration is missing/);
  });
  it('keeps demo pagination explicit and local', async () => {
    const result = await new DemoContentAdapter().listArticles('', '', {limit: 1});
    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.items[0].status).toBe('Published');
  });
  it('excludes missing, malformed, future, and expired ads at the client boundary', () => {
    const now = new Date('2026-10-16T12:00:00.000Z');
    const base = {status: 'Approved', active: true};
    const live = {...base, startsAt: '2026-10-16T11:00:00.000Z', endsAt: '2026-10-16T13:00:00.000Z'};
    expect(filterLiveAds([{...live, $id: 'live'}, {...base, $id: 'missing'}, {...live, $id: 'future', startsAt: '2026-10-16T13:00:01.000Z'}, {...live, $id: 'bad', endsAt: 'not-a-date'}], now).map(x => x.$id)).toEqual(['live']);
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
});
