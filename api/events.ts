import {Client, Databases, ID} from 'appwrite';

const allowed = new Set(['article_opened', 'article_saved', 'article_shared', 'ad_opened', 'ad_impression', 'ad_rotated', 'ad_contact_clicked', 'ad_reported', 'advertise_cta_clicked', 'advertise_whatsapp_launch', 'sidebar_open', 'sidebar_item_selected', 'search_used', 'admin_action']);
const properties: Record<string, Set<string>> = {
  article_opened: new Set(['id', 'category']), article_saved: new Set(['id', 'saved']), article_shared: new Set(['id']),
  ad_opened: new Set(['id']), ad_impression: new Set(['id', 'placement']), ad_rotated: new Set(['id', 'placement']), ad_contact_clicked: new Set(['id', 'placement', 'contact']), ad_reported: new Set(['id']), advertise_cta_clicked: new Set(['path', 'listing']), advertise_whatsapp_launch: new Set(['outcome']),
  sidebar_open: new Set([]), sidebar_item_selected: new Set(['item']), search_used: new Set(['queryLength']), admin_action: new Set(['action']),
};
const enums: Record<string, Record<string, Set<string>>> = {
  article_opened: {category: new Set(['Community', 'Business', 'Culture', 'Sport', 'Civic'])},
  ad_impression: {placement: new Set(['home-top', 'home-latest-end', 'home-directory-end', 'section', 'search', 'community', 'article'])},
  ad_rotated: {placement: new Set(['home-top', 'home-latest-end', 'home-directory-end', 'section', 'search', 'community', 'article'])},
  ad_contact_clicked: {placement: new Set(['home-top', 'home-latest-end', 'home-directory-end', 'section', 'search', 'community', 'article']), contact: new Set(['Call', 'WhatsApp', 'Email', 'Website', 'Directions'])},
  advertise_cta_clicked: {path: new Set(['header', 'sidebar', 'directory'])},
  advertise_whatsapp_launch: {outcome: new Set(['success', 'failure'])},
  admin_action: {action: new Set(['New article draft created', 'Opened The city that chooses to stay ready', 'Opened A field guide to the Sunday game', 'Opened Planning a winter on the high street'])},
};
const buckets = new Map<string, {count: number; reset: number}>();
const json = (res: any, status: number, body: unknown) => { res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body)); };

function originAllowed(req: any) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const configured = (process.env.APP_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (configured.length) return configured.includes(origin);
  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  return Boolean(host && origin === `${protocol}://${host}`);
}

function validPayload(value: any) {
  if (!value || typeof value !== 'object' || !allowed.has(value.name) || typeof value.at !== 'string' || Number.isNaN(Date.parse(value.at))) return false;
  if (!value.properties || typeof value.properties !== 'object' || Array.isArray(value.properties)) return false;
  const keys = Object.keys(value.properties);
  if (keys.some(key => !properties[value.name].has(key)) || keys.length > 5) return false;
  return keys.every(key => ['string', 'number', 'boolean'].includes(typeof value.properties[key]) && String(value.properties[key]).length <= 160 && (!enums[value.name]?.[key] || enums[value.name][key].has(String(value.properties[key]))));
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') { if (!originAllowed(req)) return json(res, 403, {error: 'origin_not_allowed'}); res.status(204).setHeader('Access-Control-Allow-Origin', req.headers.origin || '*').setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS').setHeader('Access-Control-Allow-Headers', 'Content-Type').end(); return; }
  if (req.method !== 'POST') return json(res, 405, {error: 'method_not_allowed'});
  if (!originAllowed(req)) return json(res, 403, {error: 'origin_not_allowed'});
  const key = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
  const now = Date.now(); const bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) buckets.set(key, {count: 1, reset: now + 60_000}); else if (++bucket.count > 60) return json(res, 429, {error: 'rate_limited'});
  if (!validPayload(req.body)) return json(res, 400, {error: 'invalid_event'});
  if (!process.env.APPWRITE_API_KEY || !process.env.APPWRITE_ENDPOINT || !process.env.APPWRITE_PROJECT_ID || !process.env.APPWRITE_DATABASE_ID || !process.env.APPWRITE_ANALYTICS_COLLECTION_ID) return json(res, 503, {error: 'analytics_persistence_not_configured'});
  const client = new Client().setEndpoint(process.env.APPWRITE_ENDPOINT).setProject(process.env.APPWRITE_PROJECT_ID).setKey(process.env.APPWRITE_API_KEY);
  const db = new Databases(client);
  try { await db.createDocument(process.env.APPWRITE_DATABASE_ID, process.env.APPWRITE_ANALYTICS_COLLECTION_ID, ID.unique(), {name: req.body.name, properties: JSON.stringify(req.body.properties), occurredAt: req.body.at}); }
  catch { return json(res, 502, {error: 'analytics_persistence_failed'}); }
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*'); return json(res, 202, {accepted: true});
}
