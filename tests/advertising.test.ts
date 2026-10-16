import {describe,expect,it} from 'vitest';
import {adContactUrls,eligibleAds,isEligibleAd,nextAd,publicAdContacts,AD_ROTATION_INTERVAL_MS} from '../src/advertising';
import type {Ad} from '../src/data';

const base:Ad={id:'a',business:'A',title:'A',description:'A',category:'Services',location:'Here',accent:'blue',status:'Approved',active:true,startsAt:'2026-10-01T00:00:00Z',endsAt:'2026-10-31T23:59:59Z',placements:['home-top'],priority:1};
const contacts={phone:'+2712 555 0101',email:'hello@example.com',website:'https://example.com',directionsUrl:'https://maps.example',whatsapp:'+2712 555 0101'};

describe('advertising inventory',()=>{
  it('uses a documented fifteen second rotation default',()=>expect(AD_ROTATION_INTERVAL_MS).toBe(15_000));
  it('filters approval, active date and placement',()=>{const now=new Date('2026-10-16T12:00:00Z');expect(isEligibleAd(base,'home-top',now)).toBe(true);expect(isEligibleAd({...base,status:'Pending'},'home-top',now)).toBe(false);expect(isEligibleAd({...base,placements:['section']},'home-top',now)).toBe(false);expect(eligibleAds([base,{...base,id:'future',startsAt:'2026-11-01T00:00:00Z'}],'home-top',now).map(ad=>ad.id)).toEqual(['a'])});
  it('advances in order and wraps to the first eligible ad',()=>{const items=[base,{...base,id:'b'},{...base,id:'c'}];expect(nextAd(items,'a')?.id).toBe('b');expect(nextAd(items,'b')?.id).toBe('c');expect(nextAd(items,'c')?.id).toBe('a');expect(nextAd([base],'a')?.id).toBe('a')});
  it('denies all contact actions when consent is missing or false',()=>{expect(publicAdContacts({...base,contacts})).toBeUndefined();expect(adContactUrls({...base,contacts,contactConsent:false})).toEqual([])});
  it('supports explicit legacy all-fields consent',()=>expect(publicAdContacts({...base,contacts,contactConsent:true})).toEqual(contacts));
  it('returns only explicitly consented allow-listed contact fields',()=>expect(publicAdContacts({...base,contacts:{...contacts,secret:'private'} as Ad['contacts'],contactConsent:{phoneConsent:true,emailConsent:false,websiteConsent:true,directionsUrlConsent:true,whatsappConsent:true}})).toEqual({phone:contacts.phone,website:contacts.website,directionsUrl:contacts.directionsUrl,whatsapp:contacts.whatsapp}));
  it('creates only configured contact URLs',()=>expect(adContactUrls({...base,contacts,contactConsent:true})).toHaveLength(5));
  it('rejects unsafe public URLs and mismatched contact schemes',()=>expect(adContactUrls({...base,contactConsent:true,contacts:{phone:'javascript:alert(1)',email:'javascript:alert(1)',website:'javascript:alert(1)',directionsUrl:'data:text/html,bad'}})).toEqual([]));
  it('does not treat a non-https website as public',()=>expect(adContactUrls({...base,contactConsent:true,contacts:{website:'http://example.com'}})).toEqual([]));
});
