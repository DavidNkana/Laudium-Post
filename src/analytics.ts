import {contentMode} from './adapter';

export const EVENT_NAMES = ['article_opened', 'article_saved', 'article_shared', 'ad_opened', 'ad_impression', 'ad_rotated', 'ad_contact_clicked', 'ad_reported', 'advertise_cta_clicked', 'advertise_whatsapp_launch', 'sidebar_open', 'sidebar_item_selected', 'search_used', 'admin_action'] as const;
export type EventName = typeof EVENT_NAMES[number];
export type AnalyticsValue = string | number | boolean;
export type AnalyticsEvent = {name: EventName; properties: Record<string, AnalyticsValue>; at: string};

const propertyAllowList: Record<EventName, string[]> = {
  article_opened: ['id', 'category'], article_saved: ['id', 'saved'], article_shared: ['id'],
  ad_opened: ['id'], ad_impression: ['id','placement'], ad_rotated: ['id','placement'], ad_contact_clicked: ['id','contact'], ad_reported: ['id'], advertise_cta_clicked: ['path', 'listing'], advertise_whatsapp_launch: ['outcome'],
  sidebar_open: [], sidebar_item_selected: ['item'],
  // Search terms are deliberately not an allowed property.
  search_used: ['queryLength'], admin_action: ['action'],
};
const propertyEnums: Partial<Record<EventName, Partial<Record<string, readonly AnalyticsValue[]>>>> = {
  article_opened: {category: ['Community', 'Business', 'Culture', 'Sport', 'Civic']},
  ad_impression: {placement: ['home-top', 'home-latest-end', 'home-directory-end', 'section', 'search', 'community', 'article']},
  ad_rotated: {placement: ['home-top', 'home-latest-end', 'home-directory-end', 'section', 'search', 'community', 'article']},
  ad_contact_clicked: {contact: ['Call', 'WhatsApp', 'Email', 'Website', 'Directions']},
  advertise_cta_clicked: {path: ['header', 'sidebar', 'directory']},
  advertise_whatsapp_launch: {outcome: ['success', 'failure']},
  admin_action: {action: ['New article draft created', 'Opened The city that chooses to stay ready', 'Opened A field guide to the Sunday game', 'Opened Planning a winter on the high street']},
};

export type AnalyticsConfig = {durable: boolean; error?: string; endpoint?: string};
const warnedConfigErrors = new Set<string>();
// Use the reader's resolved mode: omitted VITE_CONTENT_MODE is Appwrite/live.
export function validateAnalyticsConfig(endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT, production = contentMode === 'appwrite'): AnalyticsConfig {
  // Demo content is console-observable even in a production-optimized preview.
  if (contentMode === 'demo') return {durable: false, endpoint};
  if (!production) return {durable: Boolean(endpoint), endpoint, error: undefined};
  if (!endpoint) return {durable: false, error: 'Production analytics requires VITE_ANALYTICS_ENDPOINT (an HTTPS event-ingestion endpoint).'};
  try {
    if (new URL(endpoint).protocol !== 'https:') return {durable: false, error: 'Production analytics endpoint must use HTTPS.'};
  } catch { return {durable: false, error: 'Production analytics endpoint must be a valid HTTPS URL.'}; }
  return {durable: true, endpoint, error: undefined};
}

/** Emit a production configuration warning once; demo mode remains console-observable only. */
export function announceAnalyticsConfig(config: AnalyticsConfig) {
  if (!config.error || warnedConfigErrors.has(config.error)) return;
  warnedConfigErrors.add(config.error);
  console.error(`[analytics] ${config.error}`);
}

export function sanitizeAnalyticsProperties(name: EventName, properties: Record<string, AnalyticsValue>) {
  return Object.fromEntries(propertyAllowList[name].filter(key => key in properties && (!propertyEnums[name]?.[key] || propertyEnums[name]?.[key]?.includes(properties[key]))).map(key => [key, properties[key]]));
}

/** Browser events remain useful in the local demo; production requires durable delivery. */
export function track(name: EventName, properties: Record<string, AnalyticsValue> = {}, configured = validateAnalyticsConfig()) {
  const config = configured;
  const event: AnalyticsEvent = {name, properties: sanitizeAnalyticsProperties(name, properties), at: new Date().toISOString()};
  window.dispatchEvent(new CustomEvent('laudium:analytics', {detail: event}));
  if (config.durable) {
    return deliver(event, config.endpoint!);
  } else if (config.error) {
    announceAnalyticsConfig(config);
  } else if (import.meta.env.DEV) {
    console.info('[analytics:local-demo]', event);
  }
}

export async function deliver(event: AnalyticsEvent, endpoint: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(event), keepalive: true});
      if (response.ok) return true;
    } catch { /* retry once; analytics must never block the reader */ }
    if (attempt === 0) await new Promise(resolve => window.setTimeout(resolve, 100));
  }
  window.dispatchEvent(new CustomEvent('laudium:analytics-failed', {detail: event.name}));
  console.error('[analytics] durable delivery failed after one retry');
  return false;
}
