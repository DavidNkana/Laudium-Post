export const EVENT_NAMES = ['article_opened', 'article_saved', 'article_shared', 'ad_opened', 'advertise_cta_clicked', 'search_used', 'admin_action'] as const;
export type EventName = typeof EVENT_NAMES[number];
export type AnalyticsValue = string | number | boolean;
export type AnalyticsEvent = {name: EventName; properties: Record<string, AnalyticsValue>; at: string};

const propertyAllowList: Record<EventName, string[]> = {
  article_opened: ['id', 'category'], article_saved: ['id', 'saved'], article_shared: ['id'],
  ad_opened: ['id'], advertise_cta_clicked: ['path', 'listing'],
  // Search terms are deliberately not an allowed property.
  search_used: ['queryLength'], admin_action: ['action'],
};

export type AnalyticsConfig = {durable: boolean; error?: string; endpoint?: string};
export function validateAnalyticsConfig(endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT, production = import.meta.env.PROD): AnalyticsConfig {
  if (import.meta.env.VITE_LOCAL_DEMO_MODE === 'true') return {durable: false, endpoint};
  if (!production) return {durable: Boolean(endpoint), endpoint, error: undefined};
  if (!endpoint) return {durable: false, error: 'Production analytics requires VITE_ANALYTICS_ENDPOINT (an HTTPS event-ingestion endpoint).'};
  try {
    if (new URL(endpoint).protocol !== 'https:') return {durable: false, error: 'Production analytics endpoint must use HTTPS.'};
  } catch { return {durable: false, error: 'Production analytics endpoint must be a valid HTTPS URL.'}; }
  return {durable: true, endpoint, error: undefined};
}

export function sanitizeAnalyticsProperties(name: EventName, properties: Record<string, AnalyticsValue>) {
  return Object.fromEntries(propertyAllowList[name].filter(key => key in properties).map(key => [key, properties[key]]));
}

/** Browser events remain useful in the local demo; production requires durable delivery. */
export function track(name: EventName, properties: Record<string, AnalyticsValue> = {}, configured = validateAnalyticsConfig()) {
  const config = configured;
  const event: AnalyticsEvent = {name, properties: sanitizeAnalyticsProperties(name, properties), at: new Date().toISOString()};
  window.dispatchEvent(new CustomEvent('laudium:analytics', {detail: event}));
  if (config.durable) {
    return deliver(event, config.endpoint!);
  } else if (config.error) {
    console.error(`[analytics] ${config.error}`);
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
