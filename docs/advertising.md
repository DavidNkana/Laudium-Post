# Advertising WhatsApp

Set `VITE_PUBLICATION_WHATSAPP_NUMBER` to the publication-owned WhatsApp number, including the country code and digits only. Do not put an advertiser's personal number in this setting.

The reader's **ADVERTISE WITH US** action opens WhatsApp with an editable message that says the advertiser can send an image, video, or text advert. If the setting is empty, the action does not invent a number or silently fail: it records the intent locally and shows the configuration message in the rail.

The client emits `advertise_cta_clicked` and `advertise_whatsapp_launch` (`success`/`failure`) through the existing analytics seam. The message text and phone number are never sent as analytics properties.

## WhatsApp mark

The rail button uses a locally bundled SVG copied from the [Simple Icons WhatsApp asset](https://cdn.simpleicons.org/whatsapp), a reputable open-source brand-icon source. Meta's [WhatsApp brand resource](https://www.meta.com/brand/resources/whatsapp/whatsapp-brand/) is the preferred brand reference. The artwork keeps its source colour and proportions; the button is a channel link and does not imply WhatsApp endorsement or partnership.
