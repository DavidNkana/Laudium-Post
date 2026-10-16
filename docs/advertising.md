# Advertising WhatsApp

Set `VITE_PUBLICATION_WHATSAPP_NUMBER` to the publication-owned WhatsApp number, including the country code and digits only. Do not put an advertiser's personal number in this setting.

The reader's **ADVERTISE WITH US** action opens WhatsApp with an editable message that says the advertiser can send an image, video, or text advert. If the setting is empty, the action does not invent a number or silently fail: it records the intent locally and shows the configuration message in the rail.

The client emits `advertise_cta_clicked` and `advertise_whatsapp_launch` (`success`/`failure`) through the existing analytics seam. The message text and phone number are never sent as analytics properties.

## Public advertising projection

Advertiser contact details are private source data. Each private `advertiser_records` contact has an explicit consent boolean (`phoneConsent`, `whatsappConsent`, `emailConsent`, `websiteConsent`, or `directionsUrlConsent`). The publishing function applies an explicit public allowlist (call/phone, WhatsApp, email, website, directions), validates the corresponding `tel:`, `https://`, `mailto:`, or `https://wa.me/` scheme, and copies only consented contacts into the `public_ads.contacts` projection. The client repeats this allowlist and scheme validation before returning or rendering an ad, and never returns raw `d.contacts` or consent flags. It never exposes the private collection or raw private contact columns to readers. A stale, malformed, unapproved, inactive, or out-of-date record is also rejected by both adapters, including deep links.

The public inventory uses three home placements (`home-top`, `home-latest-end`, `home-directory-end`) and low-density `section`, `community`, `search`, and `article` slots. Every slot advances every 15 seconds, loops through its eligible ads, and pauses automatic rotation on hidden documents and reduced-motion preferences. The **Next ad** control remains available for manual advances without stopping the timer.

## WhatsApp mark

The rail button uses a locally bundled SVG copied from the [Simple Icons WhatsApp asset](https://cdn.simpleicons.org/whatsapp), a reputable open-source brand-icon source. Meta's [WhatsApp brand resource](https://www.meta.com/brand/resources/whatsapp/whatsapp-brand/) is the preferred brand reference. The artwork keeps its source colour and proportions; the button is a channel link and does not imply WhatsApp endorsement or partnership.
