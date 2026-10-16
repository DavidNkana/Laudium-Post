export type DeepLink = {kind: 'article' | 'ad'; id: string};

export type DeepLinkLocation = Pick<Location, 'hash' | 'pathname'>;

/** Resolve both the original hash links and shareable pathname links. */
export function resolveDeepLink(location: DeepLinkLocation): DeepLink | undefined {
  const hash = location.hash.replace(/^#/, '');
  const hashMatch = hash.match(/^(article|ad)-(.+)$/);
  const pathMatch = location.pathname.match(/\/(article|ad)\/([^/]+)\/?$/);
  const match = hashMatch ?? pathMatch;
  return match ? {kind: match[1] as DeepLink['kind'], id: match[2]} : undefined;
}
