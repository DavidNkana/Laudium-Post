# Production runbook

This project deliberately does not contain a real Appwrite project ID, domain, WhatsApp number, or secret. Supply those values through deployment configuration.

## Vercel

1. Set the public variables in `.env.example` in the Vercel Production environment.
2. Set `VITE_CONTENT_MODE=appwrite`; do not set demo mode in Production.
3. Set server-only `APPWRITE_API_KEY`, `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_DATABASE_ID`, `APPWRITE_ANALYTICS_COLLECTION_ID`, and `APP_ALLOWED_ORIGINS` for the analytics route. Never prefix the API key with `VITE_`.
4. Set `VITE_ANALYTICS_ENDPOINT` to the deployed HTTPS ingestion endpoint if durable event measurement is part of the launch. Missing analytics is reported honestly and never blocks reading.
5. Build with `npm run build`. The Vercel rewrite serves client routes from `index.html`.

## Appwrite and first admin

Provision `docs/appwrite-schema.json`, its indexes, the public projection collections, the media bucket, and the private team collections. Create the editor team, add the first human owner/editor membership, and copy only that team ID to `VITE_APPWRITE_STAFF_TEAM_ID`. The browser verifies the signed-in Appwrite account is a member; all future write Functions must repeat authorization and role checks.

## Scheduled Functions

Use a trusted server-side Function to project only published articles and approved, active, date-live ads. Schedule it around editorial changes and ad start/end boundaries. The schedule frequency, Function ID, and project ID are deployment choices and are intentionally not invented here.

## Native shells

Native folders are not faked or committed when the platform SDK is unavailable. After installing the required Capacitor platform package:

```bash
npm run build
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios
npx cap open android
```

`capacitor.config.ts` presents the shell as **Laudium Post**, while retaining the stable `com.laudiumpost.app` app ID for upgrade compatibility. It uses the bundled `dist` directory and HTTPS Android scheme. The current web hash deep links (`#article-ID` and `#ad-ID`) remain safe in the shell. Configure platform universal/app links only after the production domain is known; no placeholder URL is shipped.
