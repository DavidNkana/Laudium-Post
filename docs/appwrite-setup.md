# Appwrite setup

The default is `VITE_CONTENT_MODE=appwrite`: the reader fails closed rather than showing fictional content when setup is incomplete. Fictional stories/businesses load only when both `VITE_CONTENT_MODE=demo` and `VITE_LOCAL_DEMO_MODE=true` are explicitly set.

To use production content:

1. Create the database and collections in `docs/appwrite-schema.json`. Set `VITE_CONTENT_MODE=appwrite`, the endpoint, project, database, and **public** collection IDs in `.env.local`.
2. Provision every attribute and index in `docs/appwrite-schema.json` before launch. In particular, `Query.search` needs the five named full-text indexes (`articles_title_search`, `articles_excerpt_search`, `ads_business_search`, `ads_title_search`, `ads_category_search`); the app does not silently fall back to an unindexed scan. Grant `read("any")` only to `public_articles`, `public_ads`, and `public_categories`. The public ads projection contains no phone/email/private advertiser fields. The adapter additionally filters articles to `status=Published` and `publishedAt <= now`, and ads to `status=Approved`, `active=true`, `startsAt <= now <= endsAt`, with valid dates required client-side.
3. Keep `editorial_articles` and `advertiser_records` without public read permission. A trusted Appwrite Function, using a server-only API key, should project approved/current records into the public collections. This boundary prevents drafts, scheduled, archived, pending, or private advertiser data leaking through a client query.
4. Create an editor team and restrict all private collection writes to that team. Enforce auth and role checks in the publishing function. Do not put an Appwrite API key or other admin secret in a `VITE_*` variable.
5. Add a Storage bucket for media with image transformations and size/MIME limits. Serve only published media publicly. Production corrections and advertiser submissions should go through rate-limited server functions.

If Appwrite mode has missing public configuration or a read fails, the reader shows an actionable unavailable state; it never falls back to demo fixtures. WhatsApp is optional and does not block reader startup.

## Environment ownership

| Variable | Client/public? | Purpose |
|---|---|---|
| `VITE_CONTENT_MODE` | public | `appwrite` (default) or `demo`; demo is active only with the local flag below |
| `VITE_LOCAL_DEMO_MODE` | public | Must be exactly `true` together with `VITE_CONTENT_MODE=demo`; otherwise Appwrite/live mode is used |
| `VITE_APPWRITE_ENDPOINT`, `VITE_APPWRITE_PROJECT_ID` | public | Appwrite public SDK target |
| `VITE_APPWRITE_DATABASE_ID`, `VITE_APPWRITE_*_COLLECTION_ID`, `VITE_APPWRITE_MEDIA_BUCKET_ID` | public | Read-only public projection IDs |
| `VITE_APPWRITE_STAFF_TEAM_ID` | public | Team identifier only; auth still gates access |
| `VITE_ANALYTICS_ENDPOINT`, `VITE_PUBLICATION_WHATSAPP_NUMBER` | public | Optional reader integrations (analytics is required for durable live measurement) |
| `APPWRITE_API_KEY`, `APPWRITE_DATABASE_ID`, `APPWRITE_ANALYTICS_COLLECTION_ID`, `APP_ALLOWED_ORIGINS` | server-only | Vercel analytics ingestion; never use `VITE_` |

## First admin and deployment

Create the Appwrite team from the console, add the first admin/editor membership, then set its team ID as `VITE_APPWRITE_STAFF_TEAM_ID`. Sign in through Appwrite Auth before opening Staff workspace. Publishing writes must be implemented in a trusted Function and repeat the team/role check; the browser has no admin API key and this UI does not pretend to edit live data.

In Vercel, set the public `VITE_*` values for Production (and Preview deliberately), set the server-only analytics values in the Function environment, and deploy with `npm run build`. Do not invent IDs or secrets. Configure the analytics Function/API route and its allowed origins before launch.

## Scheduled publishing

Schedule a trusted Appwrite Function to refresh `public_articles` and `public_ads` projections after editorial changes and at least around ad start/end boundaries. The exact schedule is an operator decision; no schedule or project ID is invented here.

## Capacitor

`webDir` is `dist`; run `npm run build`, then install platform packages and run `npx cap add ios` and/or `npx cap add android`, followed by `npx cap sync` and `npx cap open ios`/`npx cap open android`. Native directories are intentionally not committed from this environment. Use HTTPS Appwrite endpoints and configure universal/app links in the native projects when distribution URLs are known.

## Ordering and cursors

Public article pages are ordered by `publishedAt DESC, $id DESC`; ad pages use `startsAt DESC, $id DESC`. The timestamp is the business order and `$id` is the unique deterministic tie-breaker. Every page repeats that order before applying `cursorAfter(lastDocumentId)`, so equal timestamps cannot reorder records across page boundaries.

## Analytics durability

The UI always emits a `laudium:analytics` browser event. Production **must** set `VITE_ANALYTICS_ENDPOINT` to an HTTPS endpoint or Appwrite Function; config validation reports a missing or non-HTTPS endpoint and delivery failures are visible. The endpoint contract is `POST {name, properties, at}`, accepts only the `EventName` allow-list in `src/analytics.ts` (including `advertise_cta_clicked.path=header|sidebar|directory`), persists to `analytics_events`, and returns 2xx. `search_used` contains only `queryLength` (never the search text). In local demo mode, the browser event plus `[analytics:local-demo]` console output is intentionally non-durable. Do not log article bodies, email addresses, secrets, or advertiser private data.

Important business events include `advertise_cta_clicked` from the directory CTA, the advertise/contact path, and configured listing contact links. This is the conversion seam for measuring advertiser demand; the endpoint must add rate limiting, origin validation, and retention controls before launch.

## Production security

Public ad projections may include only approved, active, in-date inventory. Media records carry width/height and the reader contains posters with `object-fit: contain` (no crop). `placements`, `priority`, and `rotationKey` drive independent rotation; advertiser phone, WhatsApp, email, website, and directions fields are copied only when explicitly consented for public display (`contactConsent=true` for legacy all-fields records, or the matching per-field consent boolean). Missing/false consent must produce no public contact actions. Private advertiser records remain team-only.

There is no real auth in demo mode. The fake demo workspace requires **both** `VITE_CONTENT_MODE=demo` and `VITE_LOCAL_DEMO_MODE=true`; a missing or false flag resolves to Appwrite/live mode and is not access control. Live mode verifies an Appwrite Auth session and membership in `VITE_APPWRITE_STAFF_TEAM_ID`, but deliberately renders no editing UI until server-side editorial functions exist. Those functions must repeat team checks on every write. Analytics is delivered to `/api/events`, which requires server-only Appwrite variables and `APP_ALLOWED_ORIGINS`. Its in-memory rate limit is only a per-instance first layer; use a shared limiter before high-volume launch. Public collection permissions are not a substitute for the publishing boundary.
