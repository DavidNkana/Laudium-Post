# Appwrite setup

The default is explicit `VITE_CONTENT_MODE=demo`: stories and businesses are fictional and are never presented as live inventory. To use production content:

1. Create the database and collections in `docs/appwrite-schema.json`. Set `VITE_CONTENT_MODE=appwrite`, the endpoint, project, database, and **public** collection IDs in `.env.local`.
2. Grant `read("any")` only to `public_articles`, `public_ads`, and `public_categories`. The public ads projection contains no phone/email/private advertiser fields. The adapter additionally filters articles to `status=Published` and `publishedAt <= now`, and ads to `status=Approved` and `active=true`.
3. Keep `editorial_articles` and `advertiser_records` without public read permission. A trusted Appwrite Function, using a server-only API key, should project approved/current records into the public collections. This boundary prevents drafts, scheduled, archived, pending, or private advertiser data leaking through a client query.
4. Create an editor team and restrict all private collection writes to that team. Enforce auth and role checks in the publishing function. Do not put an Appwrite API key or other admin secret in a `VITE_*` variable.
5. Add a Storage bucket for media with image transformations and size/MIME limits. Serve only published media publicly. Production corrections and advertiser submissions should go through rate-limited server functions.

If appwrite mode is selected with missing public configuration, the app throws a clear configuration error; it never falls back to demo fixtures. Demo mode remains the safe local default.

## Analytics durability

The UI always emits a `laudium:analytics` browser event. For durable measurement, set `VITE_ANALYTICS_ENDPOINT` to an HTTPS endpoint or Appwrite Function that validates and stores the allow-listed event shape (the schema includes `analytics_events`). Without that endpoint, events are local observability only—not persisted. Do not log article bodies, email addresses, secrets, or advertiser private data.

Important business events include `advertise_cta_clicked` from the directory CTA, the advertise/contact path, and configured listing contact links. This is the conversion seam for measuring advertiser demand; the endpoint must add rate limiting, origin validation, and retention controls before launch.

## Production security

There is no real auth in demo mode. The admin preview is labelled and is not access control. Production requires Appwrite Auth, team membership checks on every write, server-side validation, rate limits, CSP, and monitoring of projection failures. Public collection permissions are not a substitute for the publishing boundary.
