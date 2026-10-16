import {Client, Databases, Query} from 'appwrite';
import {articles, ads, Article, Ad} from './data';

export type PageResult<T> = {items: T[]; nextCursor?: string; hasMore: boolean};
export type PageOptions = {cursor?: string; limit?: number};
export interface ContentAdapter {
  listArticles(query?: string, category?: string, options?: PageOptions): Promise<PageResult<Article>>;
  getArticle(id: string): Promise<Article | undefined>;
  listAds(query?: string, options?: PageOptions): Promise<PageResult<Ad>>;
  getAd(id: string): Promise<Ad | undefined>;
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
  async listAds(query = '', options: PageOptions = {}) {
    const filtered = ads.filter(a => !query || `${a.business} ${a.title} ${a.category}`.toLowerCase().includes(query.toLowerCase()));
    return page(filtered, options.cursor, options.limit);
  }
  async getAd(id: string) { return ads.find(a => a.id === id); }
}

type AppwriteConfig = {endpoint: string; projectId: string; databaseId: string; articlesCollectionId: string; adsCollectionId: string};

/**
 * Appwrite's cursor is the last document id, so every public query must use
 * the same total order. `$id` is the unique tie-breaker for equal timestamps.
 */
export const ARTICLE_ORDER = ['publishedAt DESC', '$id DESC'] as const;
export const AD_ORDER = ['startsAt DESC', '$id DESC'] as const;

export function isLiveAdDocument(document: Record<string, any>, now = new Date()): boolean {
  const startsAt = typeof document.startsAt === 'string' ? new Date(document.startsAt) : undefined;
  const endsAt = typeof document.endsAt === 'string' ? new Date(document.endsAt) : undefined;
  return document.status === 'Approved' && document.active === true && !!startsAt && !!endsAt &&
    !Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime()) &&
    startsAt.getTime() <= now.getTime() && now.getTime() <= endsAt.getTime();
}

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

export function adQueries(search: string, limit: number, cursor?: string, now = new Date()) {
  const nowIso = now.toISOString();
  const queries = [
    Query.equal('status', 'Approved'), Query.equal('active', true),
    Query.lessThanEqual('startsAt', nowIso), Query.greaterThanEqual('endsAt', nowIso),
    Query.orderDesc('startsAt'), Query.orderDesc('$id'), Query.limit(limit),
  ];
  if (cursor) queries.push(Query.cursorAfter(cursor));
  if (search) queries.push(Query.or([Query.search('business', search), Query.search('title', search), Query.search('category', search)]));
  return queries;
}

function readConfig(): AppwriteConfig {
  const config = {
    endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT,
    projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID,
    databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID,
    articlesCollectionId: import.meta.env.VITE_APPWRITE_ARTICLES_COLLECTION_ID,
    adsCollectionId: import.meta.env.VITE_APPWRITE_ADS_COLLECTION_ID,
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Appwrite content mode is enabled but configuration is missing: ${missing.join(', ')}. Set public collection IDs; never put an API key in VITE_* variables.`);
  return config as AppwriteConfig;
}

export class AppwriteContentAdapter implements ContentAdapter {
  private readonly databases: Databases;
  private readonly config: AppwriteConfig;
  constructor() {
    this.config = readConfig();
    const client = new Client().setEndpoint(this.config.endpoint).setProject(this.config.projectId);
    this.databases = new Databases(client);
  }
  async listArticles(search = '', category = '', options: PageOptions = {}) {
    const limit = Math.min(Math.max(options.limit || 6, 1), 100);
    const result = await this.databases.listDocuments(this.config.databaseId, this.config.articlesCollectionId, articleQueries(search, category, limit, options.cursor));
    return {items: result.documents.map(toArticle), nextCursor: result.documents.at(-1)?.$id, hasMore: result.documents.length === limit};
  }
  async getArticle(id: string) {
    try {
      const document = await this.databases.getDocument(this.config.databaseId, this.config.articlesCollectionId, id);
      return document.status === 'Published' && new Date(document.publishedAt) <= new Date() ? toArticle(document) : undefined;
    } catch (error) { if ((error as {code?: number}).code === 404) return undefined; throw error; }
  }
  async listAds(search = '', options: PageOptions = {}) {
    const limit = Math.min(Math.max(options.limit || 6, 1), 100);
    const result = await this.databases.listDocuments(this.config.databaseId, this.config.adsCollectionId, adQueries(search, limit, options.cursor));
    // Query bounds reduce leakage and work efficiently; this second check is
    // intentional because public projections can be stale or malformed.
    const items = filterLiveAds(result.documents).map(toAd);
    return {items, nextCursor: result.documents.at(-1)?.$id, hasMore: result.documents.length === limit};
  }
  async getAd(id: string) {
    try {
      const document = await this.databases.getDocument(this.config.databaseId, this.config.adsCollectionId, id);
      return isLiveAdDocument(document) ? toAd(document) : undefined;
    } catch (error) { if ((error as {code?: number}).code === 404) return undefined; throw error; }
  }
}

const toArticle = (d: Record<string, any>): Article => ({id: d.$id, title: d.title, excerpt: d.excerpt, body: Array.isArray(d.body) ? d.body : [d.body], category: d.category, author: d.author, date: new Date(d.publishedAt).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'}), readTime: d.readTime || '5 min read', accent: d.accent || 'ink', featured: d.featured, status: d.status});
const toAd = (d: Record<string, any>): Ad => ({id: d.$id, business: d.business, title: d.title, description: d.description, category: d.category, location: d.location, phone: d.phone, accent: d.accent || 'blue', featured: d.featured, startsAt: d.startsAt, endsAt: d.endsAt});

export const contentAdapter: ContentAdapter = import.meta.env.VITE_CONTENT_MODE === 'appwrite' ? new AppwriteContentAdapter() : new DemoContentAdapter();
