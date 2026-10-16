import {describe, expect, it} from 'vitest';
import {detailFallbackPath,resolveDeepLink,screenPath} from '../src/routing';
import {decodeDeepLinkId} from '../src/App';

describe('deep-link resolution', () => {
  it('resolves direct article pathname URLs', () => {
    expect(resolveDeepLink({pathname: '/article/city-ready', hash: ''})).toEqual({kind: 'article', id: 'city-ready'});
  });

  it('resolves direct ad pathname URLs with a trailing slash', () => {
    expect(resolveDeepLink({pathname: '/ad/bloom/', hash: ''})).toEqual({kind: 'ad', id: 'bloom'});
  });

  it('keeps legacy hash links compatible and gives them precedence', () => {
    expect(resolveDeepLink({pathname: '/article/ignored', hash: '#ad-bloom'})).toEqual({kind: 'ad', id: 'bloom'});
    expect(resolveDeepLink({pathname: '/article/ignored', hash: '#article-city-ready'})).toEqual({kind: 'article', id: 'city-ready'});
  });

  it('treats malformed encoded IDs as invalid instead of throwing', () => {
    expect(decodeDeepLinkId({kind: 'article', id: '%' })).toBeUndefined();
    expect(decodeDeepLinkId({kind: 'ad', id: 'local%20listing'})).toBe('local listing');
  });

  it('cleans direct detail URLs to their owning listing', () => {
    expect(detailFallbackPath('article', '?edition=1')).toBe('/?edition=1');
    expect(detailFallbackPath('ad')).toBe('/ads');
  });

  it('canonicalizes every sidebar destination without carrying an ad hash', () => {
    expect(screenPath('home', '?edition=1')).toBe('/');
    expect(screenPath('sections', '?edition=1')).toBe('/');
    expect(screenPath('search', '?edition=1')).toBe('/?edition=1');
    expect(screenPath('saved', '?edition=1')).toBe('/');
    expect(screenPath('more', '?edition=1')).toBe('/');
    expect(screenPath('ads', '?edition=1')).toBe('/ads');
    expect(resolveDeepLink({pathname: screenPath('home'), hash: ''})).toBeUndefined();
    expect(resolveDeepLink({pathname: screenPath('sections'), hash: ''})).toBeUndefined();
  });
});
