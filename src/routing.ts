export type DeepLink = {kind: 'article' | 'ad'; id: string};

export type DeepLinkLocation = Pick<Location, 'hash' | 'pathname'>;

export type ReaderScreen = 'home' | 'sections' | 'search' | 'saved' | 'more' | 'ads';

/** Resolve both the original hash links and shareable pathname links. */
export function resolveDeepLink(location: DeepLinkLocation): DeepLink | undefined {
  const hash = location.hash.replace(/^#/, '');
  const hashMatch = hash.match(/^(article|ad)-(.+)$/);
  const pathMatch = location.pathname.match(/\/(article|ad)\/([^/]+)\/?$/);
  const match = hashMatch ?? pathMatch;
  return match ? {kind: match[1] as DeepLink['kind'], id: match[2]} : undefined;
}

export function detailFallbackPath(kind: DeepLink['kind'], search = ''): string {
  return `${kind === 'ad' ? '/ads' : '/'}${search}`;
}

/** Canonical URLs for reader screens. Detail hashes must never leak into these links. */
export function screenPath(screen: ReaderScreen, search = ''): string {
  return `${screen === 'ads' ? '/ads' : '/'}${screen === 'search' ? search : ''}`;
}
