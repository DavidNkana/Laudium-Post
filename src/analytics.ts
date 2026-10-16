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
    void fetch(config.endpoint!, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(event), keepalive: true})
      .catch(() => console.error('[analytics] durable delivery failed'));
  } else if (config.error) {
    console.error(`[analytics] ${config.error}`);
  } else if (import.meta.env.DEV) {
    console.info('[analytics:local-demo]', event);
  }
}
