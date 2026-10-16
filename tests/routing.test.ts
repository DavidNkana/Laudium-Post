import {describe, expect, it} from 'vitest';
import {detailFallbackPath,resolveDeepLink} from '../src/routing';

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

  it('cleans direct detail URLs to their owning listing', () => {
    expect(detailFallbackPath('article', '?edition=1')).toBe('/?edition=1');
    expect(detailFallbackPath('ad')).toBe('/ads');
  });
});
