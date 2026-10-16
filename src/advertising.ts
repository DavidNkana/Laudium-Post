import type {Ad, AdPlacement} from './data';

/** Deliberately configurable: 10s is long enough to read a poster without making the slot static. */
export const AD_ROTATION_INTERVAL_MS = 10_000;
export const AD_MEANINGFUL_VISIBILITY_MS = 800;

export function isEligibleAd(ad: Ad, placement: AdPlacement, now = new Date()): boolean {
  if (ad.status !== 'Approved' || ad.active !== true || !ad.startsAt || !ad.endsAt || !ad.placements?.includes(placement)) return false;
  const start = new Date(ad.startsAt).getTime(); const end = new Date(ad.endsAt).getTime(); const time = now.getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start <= time && time <= end;
}

export function eligibleAds(ads: Ad[], placement: AdPlacement, now = new Date()): Ad[] {
  return ads.filter(ad => isEligibleAd(ad, placement, now)).sort((a,b) => (b.priority || 0) - (a.priority || 0) || a.id.localeCompare(b.id));
}

export function nextAd(items: Ad[], currentId: string | undefined, recentIds: string[] = []): Ad | undefined {
  if (!items.length) return undefined;
  const withoutRecent = items.filter(item => !recentIds.includes(item.id) && item.id !== currentId);
  const pool = withoutRecent.length ? withoutRecent : items.filter(item => item.id !== currentId);
  return pool[0] || items[0];
}

export function publicAdContacts(ad: Ad) {
  return ad.contacts;
}

function safeHttpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

function safeTel(value: string | undefined): string | undefined {
  if (!value || !/^[+\d][\d\s().-]{5,}$/.test(value)) return undefined;
  return `tel:${value.replace(/[^+\d]/g, '')}`;
}

function safeMailto(value: string | undefined): string | undefined {
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return undefined;
  return `mailto:${value}`;
}

export function adContactUrls(ad: Ad): Array<{label:string;href:string}> {
  const contacts = ad.contacts || {}; const actions:Array<{label:string;href:string}> = [];
  const phone = safeTel(contacts.phone); if (phone) actions.push({label:'Call',href:phone});
  if (contacts.whatsapp) actions.push({label:'WhatsApp',href:`https://wa.me/${contacts.whatsapp.replace(/\D/g,'')}`});
  const email = safeMailto(contacts.email); if (email) actions.push({label:'Email',href:email});
  const website = safeHttpsUrl(contacts.website); if (website) actions.push({label:'Website',href:website});
  const directions = safeHttpsUrl(contacts.directionsUrl); if (directions) actions.push({label:'Directions',href:directions});
  return actions;
}
