import {Client, Query, Storage} from 'appwrite';
import {articles, ads, Article, Ad, AdMedia, AdPlacement, Category} from './data';
import {eligibleAds, publicAdContacts} from './advertising';

export type PageResult<T> = {items: T[]; nextCursor?: string; hasMore: boolean};
export type PageOptions = {cursor?: string; limit?: number};
export const AD_PAGE_LIMIT = 100;
export interface ContentAdapter {
  listArticles(query?: string, category?: string, options?: PageOptions): Promise<PageResult<Article>>;
  getArticle(id: string): Promise<Article | undefined>;
  listAds(query?: string, options?: PageOptions, placement?: AdPlacement): Promise<PageResult<Ad>>;
  getAd(id: string): Promise<Ad | undefined>;
  listCategories(): Promise<Category[]>;
}

const page = <T>(items: T[], cursor = '', limit = 6): PageResult<T> => {
  const start = Number(cursor || 0);
  const slice = items.slice(start, start + limit);
  return {items: slice, nextCursor: start + slice.length < items.length ? String(start + slice.length) : undefined, hasMore: start + slice.length < items.length};
};

export class DemoContentAdapter implements ContentAdapter {
  async listArticles(query = '', category = '', options: PageOptions = {}) {
    const filtered = articles.filter(a => (!query || `${a.title} ${a.excerpt}`.toLowerCase().includes(query.toLowerCase())) && (!category || a.category === category));
    return page(filtered, options.cursor, options.limit);
  }
  async getArticle(id: string) { return articles.find(a => a.id === id); }
  async listAds(query = '', options: PageOptions = {}, placement?: AdPlacement) {
    const filtered = (placement ? eligibleAds(ads, placement).map(toPublicAd) : ads.filter(ad => isPublicAdEligible(ad)).map(toPublicAd)).filter(a => !query || `${a.business} ${a.title} ${a.category}`.toLowerCase().includes(query.toLowerCase()));
    return page(filtered, options.cursor, options.limit);
  }
  async getAd(id: string) { const ad = ads.find(a => a.id === id); return ad && isPublicAdEligible(ad) ? toPublicAd(ad) : undefined; }
  async listCategories() { return [...new Set(articles.map(article => article.category))]; }
}

export type AppwriteConfig = {endpoint: string; projectId: string; databaseId: string; articlesCollectionId: string; adsCollectionId: string; categoriesCollectionId: string; mediaBucketId?: string};

type TablesDbResponse = {rows?: Record<string, any>[]; total?: number};
type AppwriteFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const appwriteFetch: AppwriteFetcher = (input, init) => globalThis.fetch(input, init);

/**
 * The installed web SDK (17.0.2) predates TablesDB, so its Databases service
 * cannot read tables created by the current Appwrite console. Keep the REST
 * seam small and typed until the SDK used by this app exposes TablesDB.
 * TablesDB's public read endpoints are /tablesdb/.../tables/.../rows; this
 * deliberately never falls back to the legacy /databases/.../collections API.
 */
export class TablesDbReader {
  constructor(private readonly endpoint: string, private readonly projectId: string, private readonly databaseId: string, private readonly fetcher: AppwriteFetcher = appwriteFetch) {}

  private url(tableId: string, rowId?: string) {
    const path = `/tablesdb/${encodeURIComponent(this.databaseId)}/tables/${encodeURIComponent(tableId)}/rows${rowId ? `/${encodeURIComponent(rowId)}` : ''}`;
    return new URL(`${this.endpoint.replace(/\/$/, '')}${path}`);
  }
  async listRows(tableId: string, queries: string[] = []) {
    const url = this.url(tableId);
    queries.forEach(query => url.searchParams.append('queries[]', query));
    const response = await this.fetcher(url, {headers: {'X-Appwrite-Project': this.projectId, Accept: 'application/json'}});
    return this.read<TablesDbResponse>(response);
  }
  async getRow(tableId: string, rowId: string) {
    const response = await this.fetcher(this.url(tableId, rowId), {headers: {'X-Appwrite-Project': this.projectId, Accept: 'application/json'}});
    return this.read<Record<string, any>>(response);
  }
  private async read<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = new Error(`Appwrite TablesDB request failed (${response.status})`);
      Object.assign(error, {code: response.status});
      throw error;
    }
    return response.json() as Promise<T>;
  }
}

/**
 * Appwrite's cursor is the last document id, so every public query must use
 * the same total order. `$id` is the unique tie-breaker for equal timestamps.
 */
export const ARTICLE_ORDER = ['publishedAt DESC', '$id DESC'] as const;
export const AD_ORDER = ['startsAt DESC', '$id DESC'] as const;

/**
 * TablesDB provisions JSON-shaped fields as longtext. Keep the wire format
 * explicit so reads and future trusted writes use the same representation.
 */
export function serializeStructuredValue(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('Structured value must be JSON serializable');
  return serialized;
}

function parseStructuredObject(value: unknown): Record<string, any> | undefined {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return undefined; }
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? {...parsed as Record<string, any>} : undefined;
}

type StoredAdMedia = AdMedia & {fileId?: string; posterFileId?: string};

function parseMedia(value: unknown): StoredAdMedia | undefined {
  const media = parseStructuredObject(value);
  if (!media || (typeof media.url !== 'string' && typeof media.fileId !== 'string') || !['image', 'video'].includes(media.type) || !Number.isFinite(media.width) || !Number.isFinite(media.height)) return undefined;
  return media as StoredAdMedia;
}

function parseArticleBody(value: unknown): string[] {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }
  return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : [];
}

export function isLiveAdDocument(document: Record<string, any>, now = new Date()): boolean {
  const startsAt = typeof document.startsAt === 'string' ? new Date(document.startsAt) : undefined;
  const endsAt = typeof document.endsAt === 'string' ? new Date(document.endsAt) : undefined;
  return document.status === 'Approved' && document.active === true && !!startsAt && !!endsAt &&
    !Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime()) &&
    startsAt.getTime() <= now.getTime() && now.getTime() <= endsAt.getTime();
}

export function isPublicAdEligible(ad: Ad, now = new Date()): boolean {
  return ad.status === 'Approved' && ad.active === true && !!ad.startsAt && !!ad.endsAt &&
    Number.isFinite(new Date(ad.startsAt).getTime()) && Number.isFinite(new Date(ad.endsAt).getTime()) &&
    new Date(ad.startsAt).getTime() <= now.getTime() && now.getTime() <= new Date(ad.endsAt).getTime();
}

const toPublicAd = (ad: Ad): Ad => {
  const {contactConsent: _contactConsent, contacts: _contacts, ...publicAd} = ad;
  return {...publicAd, contacts: publicAdContacts(ad)};
};

export function filterLiveAds(documents: Record<string, any>[], now = new Date()) {
  return documents.filter(document => isLiveAdDocument(document, now));
}

export function articleQueries(search: string, category: string, limit: number, cursor?: string) {
  const queries = [
    Query.equal('status', 'Published'),
    Query.lessThanEqual('publishedAt', new Date().toISOString()),
    Query.orderDesc('publishedAt'), Query.orderDesc('$id'), Query.limit(limit),
  ];
  if (cursor) queries.push(Query.cursorAfter(cursor));
  if (category) queries.push(Query.equal('category', category));
  if (search) queries.push(Query.or([Query.search('title', search), Query.search('excerpt', search)]));
  return queries;
}

export function adQueries(search: string, limit: number, cursor?: string, now = new Date(), placement?: AdPlacement) {
  const nowIso = now.toISOString();
  const queries = [
    Query.equal('status', 'Approved'), Query.equal('active', true),
    Query.lessThanEqual('startsAt', nowIso), Query.greaterThanEqual('endsAt', nowIso),
    Query.orderDesc('startsAt'), Query.orderDesc('$id'), Query.limit(limit),
  ];
  if (cursor) queries.push(Query.cursorAfter(cursor));
  if (search) queries.push(Query.or([Query.search('business', search), Query.search('title', search), Query.search('category', search)]));
  if (placement) queries.push(Query.contains('placements', placement));
  return queries;
}

/** Exhaust the placement-filtered cursor, rather than rotating only the first page. */
export async function listAllAds(adapter: Pick<ContentAdapter, 'listAds'>, placement?: AdPlacement, search = ''): Promise<Ad[]> {
  const all: Ad[] = []; let cursor: string | undefined; let pages = 0;
  do {
    const result = await adapter.listAds(search, {cursor, limit: AD_PAGE_LIMIT}, placement);
    all.push(...result.items); cursor = result.nextCursor; pages += 1;
    if (!result.hasMore || !cursor || pages >= 20) break;
  } while (true);
  return all.filter((ad, index, items) => items.findIndex(item => item.id === ad.id) === index);
}

/** Load the complete public inventory once, partitioned by every supported placement. */
export async function listAllPlacementAds(adapter: Pick<ContentAdapter, 'listAds'>, placements: AdPlacement[], search = ''): Promise<Ad[]> {
  const groups = await Promise.all(placements.map(placement => listAllAds(adapter, placement, search)));
  const unique = new Map<string, Ad>();
  groups.flat().forEach(ad => unique.set(ad.id, ad));
  return [...unique.values()];
}

function readConfig(): AppwriteConfig {
  const config = {
    endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT,
    projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID,
    databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID,
    articlesCollectionId: import.meta.env.VITE_APPWRITE_ARTICLES_COLLECTION_ID,
    adsCollectionId: import.meta.env.VITE_APPWRITE_ADS_COLLECTION_ID,
    categoriesCollectionId: import.meta.env.VITE_APPWRITE_CATEGORIES_COLLECTION_ID,
    mediaBucketId: import.meta.env.VITE_APPWRITE_MEDIA_BUCKET_ID,
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Appwrite content mode is enabled but configuration is missing: ${missing.join(', ')}. Set public collection IDs; never put an API key in VITE_* variables.`);
  return config as AppwriteConfig;
}

export class AppwriteContentAdapter implements ContentAdapter {
  private readonly tables: TablesDbReader;
  private readonly storage: Storage;
  private readonly config: AppwriteConfig;
  constructor() {
    this.config = readConfig();
    const client = new Client().setEndpoint(this.config.endpoint).setProject(this.config.projectId);
    this.tables = new TablesDbReader(this.config.endpoint, this.config.projectId, this.config.databaseId);
    this.storage = new Storage(client);
  }
  async listArticles(search = '', category = '', options: PageOptions = {}) {
    const limit = Math.min(Math.max(options.limit || 6, 1), AD_PAGE_LIMIT);
    const result = await this.tables.listRows(this.config.articlesCollectionId, articleQueries(search, category, limit, options.cursor));
    const rows = result.rows || [];
    return {items: rows.map(toArticle), nextCursor: rows.at(-1)?.$id, hasMore: rows.length === limit};
  }
  async getArticle(id: string) {
    try {
      const document = await this.tables.getRow(this.config.articlesCollectionId, id);
      return document.status === 'Published' && new Date(document.publishedAt) <= new Date() ? toArticle(document) : undefined;
    } catch (error) { if ((error as {code?: number}).code === 404) return undefined; throw error; }
  }
  async listAds(search = '', options: PageOptions = {}, placement?: AdPlacement) {
    const limit = Math.min(Math.max(options.limit || 6, 1), AD_PAGE_LIMIT);
    const result = await this.tables.listRows(this.config.adsCollectionId, adQueries(search, limit, options.cursor, new Date(), placement));
    // Query bounds reduce leakage and work efficiently; this second check is
    // intentional because public projections can be stale or malformed.
    const rows = result.rows || [];
    const items = filterLiveAds(rows).filter(document => !placement || Array.isArray(document.placements) && document.placements.includes(placement)).map(document => toAd(document, this.storage, this.config.mediaBucketId));
    return {items, nextCursor: rows.at(-1)?.$id, hasMore: rows.length === limit};
  }
  async getAd(id: string) {
    try {
      const document = await this.tables.getRow(this.config.adsCollectionId, id);
      return isLiveAdDocument(document) ? toAd(document, this.storage, this.config.mediaBucketId) : undefined;
    } catch (error) { if ((error as {code?: number}).code === 404) return undefined; throw error; }
  }
  async listCategories() {
    const result = await this.tables.listRows(this.config.categoriesCollectionId, [Query.equal('active', true), Query.orderAsc('sortOrder'), Query.limit(100)]);
    return (result.rows || []).map(row => row.name as Category).filter(Boolean);
  }
}

export const toArticle = (d: Record<string, any>): Article => ({id: d.$id, title: d.title, excerpt: d.excerpt, body: parseArticleBody(d.body), category: d.category, author: d.author, date: new Date(d.publishedAt).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'}), readTime: d.readTime || '5 min read', accent: d.accent || 'ink', featured: d.featured, status: d.status});
export const toAd = (d: Record<string, any>, storage?: Storage, bucketId?: string): Ad => {
  const media = parseMedia(d.media);
  const contacts = parseStructuredObject(d.contacts);
  if (media && !media.url && media.fileId && storage && bucketId) media.url = storage.getFileView(bucketId, media.fileId).toString();
  if (media && media.posterFileId && storage && bucketId) media.posterUrl = storage.getFileView(bucketId, media.posterFileId).toString();
  // The trusted public_ads projection has already applied source consent and
  // contains only sanitized public channels. Assert that boundary explicitly
  // so the strict source/demo consent check does not hide valid projections.
  const ad: Ad = {id: d.$id, business: d.business, title: d.title, description: d.description, offer: d.offer, category: d.category, location: d.location, serviceArea: d.serviceArea, contacts, contactConsent: true, accent: d.accent || 'blue', featured: d.featured, startsAt: d.startsAt, endsAt: d.endsAt, status:d.status, active:d.active, placements:d.placements, priority:d.priority, rotationKey:d.rotationKey, media};
  return {...ad, contacts: publicAdContacts(ad)};
};

class UnavailableContentAdapter implements ContentAdapter {
  constructor(private readonly reason: Error) {}
  private fail<T>(): Promise<T> { return Promise.reject(this.reason); }
  listArticles() { return this.fail<PageResult<Article>>(); }
  getArticle() { return this.fail<Article | undefined>(); }
  listAds() { return this.fail<PageResult<Ad>>(); }
  getAd() { return this.fail<Ad | undefined>(); }
  listCategories() { return this.fail<Category[]>(); }
}

export type ContentMode = 'demo' | 'appwrite';

/** Demo is enabled only by the deliberate combination of both local opt-ins. */
export function resolveContentMode(contentModeEnv?: string, localDemoEnv?: string): ContentMode {
  return contentModeEnv === 'demo' && localDemoEnv === 'true' ? 'demo' : 'appwrite';
}

export const contentMode = resolveContentMode(import.meta.env.VITE_CONTENT_MODE, import.meta.env.VITE_LOCAL_DEMO_MODE);
export function createContentAdapter(): ContentAdapter {
  if (contentMode === 'demo') return new DemoContentAdapter();
  try { return new AppwriteContentAdapter(); }
  catch (error) { return new UnavailableContentAdapter(error instanceof Error ? error : new Error('Appwrite public content is not configured.')); }
}
// Production is the safe default. This object never falls back to fictional fixtures.
export const contentAdapter: ContentAdapter = createContentAdapter();
