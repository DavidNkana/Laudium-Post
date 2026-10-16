export type EventName = 'article_opened'|'article_saved'|'article_shared'|'ad_opened'|'advertise_cta_clicked'|'search_used'|'admin_action';
export type AnalyticsEvent = {name: EventName; properties: Record<string, string|number|boolean>; at: string};
/** Browser events are observable locally; configure an HTTPS endpoint to make them durable. */
export function track(name: EventName, properties: Record<string, string|number|boolean> = {}) {
  const event: AnalyticsEvent = {name, properties, at: new Date().toISOString()};
  window.dispatchEvent(new CustomEvent('laudium:analytics', {detail: event}));
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
  if (endpoint) void fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(event), keepalive: true}).catch(() => undefined);
  if (import.meta.env.DEV) console.info('[analytics]', event);
}
