# Appwrite setup

The default is `VITE_CONTENT_MODE=appwrite`: the reader fails closed rather than showing fictional content when setup is incomplete. Fictional stories/businesses load only when both `VITE_CONTENT_MODE=demo` and `VITE_LOCAL_DEMO_MODE=true` are explicitly set.

To use production content:

1. Create the database and TablesDB tables in `docs/appwrite-schema.json`. Set `VITE_CONTENT_MODE=appwrite`, the endpoint, project, database, and **public** table IDs in `.env.local`.
2. Provision every column and index in `docs/appwrite-schema.json` before launch. In particular, `Query.search` needs the five named full-text indexes (`articles_title_search`, `articles_excerpt_search`, `ads_business_search`, `ads_title_search`, `ads_category_search`); the app does not silently fall back to an unindexed scan. When creating the ordering indexes manually, set `articles_published_order_id` to `publishedAt DESC, $id DESC` and `ads_starts_order_id` to `startsAt DESC, $id DESC`; these directions must match the adapter queries. Grant `read("any")` only to `public_articles`, `public_ads`, and `public_categories`. The public ads projection contains no phone/email/private advertiser fields. The adapter reads rows through `/tablesdb/{databaseId}/tables/{tableId}/rows`, preserves row IDs as cursors, and additionally filters articles to `status=Published` and `publishedAt <= now`, and ads to `status=Approved`, `active=true`, `startsAt <= now <= endsAt`, with valid dates required client-side.
3. Keep `editorial_articles` and `advertiser_records` without public read permission. A trusted Appwrite Function, using a server-only API key, should project approved/current records into the public collections. This boundary prevents drafts, scheduled, archived, pending, or private advertiser data leaking through a client query.
4. Create an editor team and restrict all private collection writes to that team. Enforce auth and role checks in the publishing function. Do not put an Appwrite API key or other admin secret in a `VITE_*` variable.
5. Add the Storage bucket from the provisioning plan with **no bucket-level permissions** (`permissions=[]`), no anonymous create/update/delete, and `fileSecurity=true`. Public access is file-level only. If the bucket already exists, manually remove its `Read Any` permission in the Appwrite Console before provisioning; provisioning intentionally fails on that drift. The trusted publishing Function adds file-level `read("any")` only after server-loading the configured source record, verifying the authenticated editor membership, live status/date, and exact media association. It revokes that file-level permission on `unpublish`.

If Appwrite mode has missing public configuration or a read fails, the reader shows an actionable unavailable state; it never falls back to demo fixtures. WhatsApp is optional and does not block reader startup.

## Environment ownership

| Variable | Client/public? | Purpose |
|---|---|---|
| `VITE_CONTENT_MODE` | public | `appwrite` (default) or `demo`; demo is active only with the local flag below |
| `VITE_LOCAL_DEMO_MODE` | public | Must be exactly `true` together with `VITE_CONTENT_MODE=demo`; otherwise Appwrite/live mode is used |
| `VITE_APPWRITE_ENDPOINT`, `VITE_APPWRITE_PROJECT_ID` | public | Appwrite public SDK target |
| `VITE_APPWRITE_DATABASE_ID`, `VITE_APPWRITE_*_COLLECTION_ID`, `VITE_APPWRITE_MEDIA_BUCKET_ID` | public | Read-only public table/bucket IDs; the legacy `*_COLLECTION_ID` variable names are retained for deployment compatibility |
| `VITE_APPWRITE_STAFF_TEAM_ID` | public | Team identifier only; auth still gates access |
| `VITE_ANALYTICS_ENDPOINT`, `VITE_PUBLICATION_WHATSAPP_NUMBER` | public | Optional reader integrations (analytics is required for durable live measurement) |
| `APPWRITE_API_KEY`, `APPWRITE_DATABASE_ID`, `APPWRITE_ANALYTICS_COLLECTION_ID`, `APP_ALLOWED_ORIGINS` | server-only | Vercel analytics ingestion; never use `VITE_` |
| `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_DATABASE_ID`, `APPWRITE_MEDIA_BUCKET_ID`, `APPWRITE_EDITORS_TEAM_ID`, `APPWRITE_ARTICLE_SOURCE_TABLE_ID`, `APPWRITE_ADVERTISER_SOURCE_TABLE_ID` | Function-only | Media publication target, private source lookup, and authorization; never expose these as `VITE_` variables |

## First admin and deployment

Create the Appwrite team from the console, add the first admin/editor membership, then set its team ID as `VITE_APPWRITE_STAFF_TEAM_ID`. Sign in through Appwrite Auth before opening Staff workspace. Deploy `functions/media-publication/function.json` and configure its listed variables in the Appwrite Function; the browser has no admin API key and this UI does not pretend to edit live data. The Function checks the authenticated invocation user against the editor team and roles on every publish/unpublish request.

### Media publication Function deployment

Create/deploy the Function from `functions/media-publication` using the values in `function.json`, then set its listed variables in Appwrite. Its request body is `{ "action": "publish" | "unpublish", "sourceType": "article" | "advertisement", "sourceId": "...", "fileId": "..." }`; `approvalStatus` is ignored. The Function loads the source row with its server-only key, checks editor-team membership, requires Published (article) or Approved + active + in-date (advertisement), and requires the exact file ID in that row's `media`. Unknown, mismatched, unpublished, or expired records are rejected. The key needs Teams membership-read, TablesDB source-row-read, and Storage file-read/update scopes.

**Deployment limitation:** this commit includes deployable Function source and configuration, but it does not deploy or create the Function in an Appwrite project. An operator must create/deploy it and configure the server-only variables/API key in Appwrite before published media can be viewed anonymously. Until then, files remain private by design.

In Vercel, set the public `VITE_*` values for Production (and Preview deliberately), set the server-only analytics values in the Function environment, and deploy with `npm run build`. Do not invent IDs or secrets. Configure the analytics Function/API route and its allowed origins before launch.

## Scheduled publishing

Schedule a trusted Appwrite Function to refresh `public_articles` and `public_ads` projections after editorial changes and at least around ad start/end boundaries. The exact schedule is an operator decision; no schedule or project ID is invented here.

## Capacitor

The native app is named **Laudium Post** (`appName`); the stable package ID remains `com.laudiumpost.app` for upgrade compatibility. `webDir` is `dist`; run `npm run build`, then install platform packages and run `npx cap add ios` and/or `npx cap add android`, followed by `npx cap sync` and `npx cap open ios`/`npx cap open android`. Native directories are intentionally not committed from this environment. Use HTTPS Appwrite endpoints and configure universal/app links in the native projects when distribution URLs are known.

## Ordering and cursors

Public article pages are ordered by `publishedAt DESC, $id DESC`; ad pages use `startsAt DESC, $id DESC`. The timestamp is the business order and `$id` is the unique deterministic tie-breaker. Every page repeats that order before applying `cursorAfter(lastRowId)`, so equal timestamps cannot reorder records across page boundaries.

## Analytics durability

The UI always emits a `laudium:analytics` browser event. Production **must** set `VITE_ANALYTICS_ENDPOINT` to an HTTPS endpoint or Appwrite Function; config validation reports a missing or non-HTTPS endpoint and delivery failures are visible. The endpoint contract is `POST {name, properties, at}`, accepts only the `EventName` allow-list in `src/analytics.ts` (including `advertise_cta_clicked.path=header|sidebar|directory`), persists to `analytics_events`, and returns 2xx. `search_used` contains only `queryLength` (never the search text). In local demo mode, the browser event plus `[analytics:local-demo]` console output is intentionally non-durable. Do not log article bodies, email addresses, secrets, or advertiser private data.

Important business events include `advertise_cta_clicked` from the directory CTA, the advertise/contact path, and configured listing contact links. This is the conversion seam for measuring advertiser demand; the endpoint must add rate limiting, origin validation, and retention controls before launch.

## Production security

Public ad projections may include only approved, active, in-date inventory. Media records carry width/height and the reader contains posters with `object-fit: contain` (no crop). `placements`, `priority`, and `rotationKey` drive independent rotation; advertiser phone, WhatsApp, email, website, and directions fields are copied only when explicitly consented for public display (`contactConsent=true` for legacy all-fields records, or the matching per-field consent boolean). Missing/false consent must produce no public contact actions. Private advertiser records remain team-only.

There is no real auth in demo mode. The fake demo workspace requires **both** `VITE_CONTENT_MODE=demo` and `VITE_LOCAL_DEMO_MODE=true`; a missing or false flag resolves to Appwrite/live mode and is not access control. Live mode verifies an Appwrite Auth session and membership in `VITE_APPWRITE_STAFF_TEAM_ID`, but deliberately renders no editing UI until server-side editorial functions exist. Those functions must repeat team checks on every write. Analytics is delivered to `/api/events`, which requires server-only Appwrite variables and `APP_ALLOWED_ORIGINS`. Its in-memory rate limit is only a per-instance first layer; use a shared limiter before high-volume launch. Public collection permissions are not a substitute for the publishing boundary.
