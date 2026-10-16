import type {Ad, AdContacts, AdPlacement} from './data';

/** Deliberately configurable: 15s gives readers time to read a poster without making the slot static. */
export const AD_ROTATION_INTERVAL_MS = 15_000;
export const AD_MEANINGFUL_VISIBILITY_MS = 800;

export function isEligibleAd(ad: Ad, placement: AdPlacement, now = new Date()): boolean {
  if (ad.status !== 'Approved' || ad.active !== true || !ad.startsAt || !ad.endsAt || !ad.placements?.includes(placement)) return false;
  const start = new Date(ad.startsAt).getTime(); const end = new Date(ad.endsAt).getTime(); const time = now.getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start <= time && time <= end;
}

export function eligibleAds(ads: Ad[], placement: AdPlacement, now = new Date()): Ad[] {
  return ads.filter(ad => isEligibleAd(ad, placement, now)).sort((a,b) => (b.priority || 0) - (a.priority || 0) || a.id.localeCompare(b.id));
}

export function nextAd(items: Ad[], currentId: string | undefined, _recentIds: string[] = []): Ad | undefined {
  if (!items.length) return undefined;
  const currentIndex = items.findIndex(item => item.id === currentId);
  if (currentIndex < 0) return items[0];
  return items[(currentIndex + 1) % items.length];
}

type PublicContactField = 'phone' | 'whatsapp' | 'email' | 'website' | 'directionsUrl';

function consented(ad: Ad, field: PublicContactField) {
  // `true` is the legacy all-fields opt-in. Object-shaped consent is
  // channel-specific; missing and false consent are always deny-by-default.
  if (ad.contactConsent === true) return true;
  if (!ad.contactConsent || typeof ad.contactConsent !== 'object') return false;
  return ad.contactConsent[`${field}Consent`] === true;
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

function safeWhatsApp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  return /^\d{7,15}$/.test(digits) ? value : undefined;
}

/** Return only validated, consented business channels from a public ad boundary. */
export function publicAdContacts(ad: Ad): AdContacts | undefined {
  const source = ad.contacts;
  if (!source) return undefined;
  const contacts: AdContacts = {};
  if (consented(ad, 'phone') && safeTel(source.phone)) contacts.phone = source.phone;
  if (consented(ad, 'whatsapp') && safeWhatsApp(source.whatsapp)) contacts.whatsapp = source.whatsapp;
  if (consented(ad, 'email') && safeMailto(source.email)) contacts.email = source.email;
  if (consented(ad, 'website') && safeHttpsUrl(source.website)) contacts.website = source.website;
  if (consented(ad, 'directionsUrl') && safeHttpsUrl(source.directionsUrl)) contacts.directionsUrl = source.directionsUrl;
  return Object.keys(contacts).length ? contacts : undefined;
}

export function adContactUrls(ad: Ad): Array<{label:string;href:string}> {
  const contacts = publicAdContacts(ad) || {}; const actions:Array<{label:string;href:string}> = [];
  const phone = safeTel(contacts.phone); if (phone) actions.push({label:'Call',href:phone});
  if (contacts.whatsapp) actions.push({label:'WhatsApp',href:`https://wa.me/${contacts.whatsapp.replace(/\D/g,'')}`});
  const email = safeMailto(contacts.email); if (email) actions.push({label:'Email',href:email});
  const website = safeHttpsUrl(contacts.website); if (website) actions.push({label:'Website',href:website});
  const directions = safeHttpsUrl(contacts.directionsUrl); if (directions) actions.push({label:'Directions',href:directions});
  return actions;
}
