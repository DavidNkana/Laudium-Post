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

export function adContactUrls(ad: Ad): Array<{label:string;href:string}> {
  const contacts = ad.contacts || {}; const actions:Array<{label:string;href:string}> = [];
  if (contacts.phone) actions.push({label:'Call',href:`tel:${contacts.phone}`});
  if (contacts.whatsapp) actions.push({label:'WhatsApp',href:`https://wa.me/${contacts.whatsapp.replace(/\D/g,'')}`});
  if (contacts.email) actions.push({label:'Email',href:`mailto:${contacts.email}`});
  if (contacts.website) actions.push({label:'Website',href:contacts.website});
  if (contacts.directionsUrl) actions.push({label:'Directions',href:contacts.directionsUrl});
  return actions;
}
