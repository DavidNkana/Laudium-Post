# Laudium Post

Laudium Post is a polished responsive local-news reader built with TypeScript, React and Vite. It is suitable for Vercel web delivery and a Capacitor shell for iOS/Android.

## Run locally

```bash
npm install
npm run dev
npm test
npm run build
```

The default is an explicitly labelled **LOCAL DEMO MODE** with fictional content and tasteful CSS artwork placeholders. No WhatsApp number is invented: the advertising contact state remains honest until `VITE_PUBLICATION_WHATSAPP_NUMBER` is configured. The number must be the publication's own WhatsApp number (digits only, including country code); the app pre-fills an editable advert enquiry message and never substitutes an advertiser's contact.

## Product and business hypothesis

Residents want a calm, trustworthy way to know what is happening nearby; local businesses want accountable neighbourhood reach. The first-session activation is opening a story, saving it, or discovering a directory listing. The initial revenue hypothesis is paid directory/advertising placements, with the directory CTA and configurable WhatsApp handoff designed to test advertiser intent without expensive infrastructure. Track the emitted events before making pricing decisions.

## Configuration

See `.env.example` and `docs/appwrite-setup.md`. `src/adapter.ts` is the remote-content seam: keep demo mode cheap and deterministic while Appwrite is validated. `vercel.json` supports client-side routes. `capacitor.config.ts` is ready for `npx cap add ios` / `npx cap add android` after installing the platform packages.

## Editorial/admin flows

The reader includes home, sections, search, saved stories, article reading, share, correction prompt, community directory and ad detail. The fake staff workspace renders only when `VITE_LOCAL_DEMO_MODE=true` (explicit local demo). Live mode verifies Appwrite Auth/team membership and shows a configuration message instead of rendering fake editing UI until server-side editorial functions exist; the demo workspace is never production security.

## Analytics and security

Vercel serves `/api/events` as the minimal ingestion endpoint. Set `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, `APPWRITE_DATABASE_ID`, and `APPWRITE_ANALYTICS_COLLECTION_ID` as server-only variables, plus comma-separated `APP_ALLOWED_ORIGINS`. The endpoint allow-lists event/property names, rejects raw search terms, validates timestamps/types, applies a best-effort per-instance limit of 60 requests/minute/IP, and persists through the Appwrite server SDK. The client requires a 2xx response and retries once; local demo mode is console-only. For multiple Vercel instances, add an edge/shared rate limiter before launch.

`vercel.json` includes a restrictive CSP, `nosniff`, referrer policy, frame denial, and Permissions-Policy. If production adds analytics, media, fonts, or third-party embeds, update `connect-src`, `img-src`, `font-src`, or `frame-src` deliberately and review the policy rather than weakening it globally. `script-src 'unsafe-inline'` is currently required by the Vite/React delivery; migrate to nonce/hash-based scripts if the deployment introduces inline script risk.
