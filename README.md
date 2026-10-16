# Laudium Post

Laudium Post is a polished responsive local-news reader built with TypeScript, React and Vite. It is suitable for Vercel web delivery and a Capacitor shell for iOS/Android.

## Run locally

```bash
npm install
npm run dev
npm test
npm run build
```

The default is an explicitly labelled **LOCAL DEMO MODE** with fictional content and tasteful CSS artwork placeholders. No WhatsApp number is invented: the advertising contact state remains honest until `VITE_ADVERTISING_WHATSAPP_NUMBER` is configured.

## Product and business hypothesis

Residents want a calm, trustworthy way to know what is happening nearby; local businesses want accountable neighbourhood reach. The first-session activation is opening a story, saving it, or discovering a directory listing. The initial revenue hypothesis is paid directory/advertising placements, with the directory CTA and configurable WhatsApp handoff designed to test advertiser intent without expensive infrastructure. Track the emitted events before making pricing decisions.

## Configuration

See `.env.example` and `docs/appwrite-setup.md`. `src/adapter.ts` is the remote-content seam: keep demo mode cheap and deterministic while Appwrite is validated. `vercel.json` supports client-side routes. `capacitor.config.ts` is ready for `npx cap add ios` / `npx cap add android` after installing the platform packages.

## Editorial/admin flows

The reader includes home, sections, search, saved stories, article reading, share, correction prompt, community directory and ad detail. “Admin preview” shows permission-aware demo auth and CRUD-like draft/publish/schedule/archive management. It is not production auth; connect Appwrite Auth/Teams before launch.
