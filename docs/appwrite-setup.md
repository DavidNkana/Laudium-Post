# Appwrite setup

The app defaults to `VITE_CONTENT_MODE=demo` and contains fictional stories/businesses. To connect production content:

1. Create an Appwrite project and database, then create the collections in `docs/appwrite-schema.json`.
2. Create an editor team and restrict write permissions to that team. Public readers get read access only to published/approved documents (enforce this in the adapter or a server function).
3. Add a Storage bucket for media with image transformations and a size/MIME limit. Do not make staff credentials public.
4. Copy `.env.example` to `.env.local`, set the endpoint/project/database/collection/bucket IDs, and set `VITE_CONTENT_MODE=appwrite`.
5. Replace `AppwriteContentAdapter` in `src/adapter.ts` with the Appwrite SDK implementation. Use server-side functions for publishing, scheduling, media moderation, WhatsApp CTA generation and corrections.

## Measurement

The UI emits `laudium:analytics` browser events for article opens/saves/shares, ad opens, searches, advertise CTA clicks and admin actions. Wire these to a privacy-conscious analytics endpoint before launch. Do not log article content, email addresses or secrets.

## Security notes

There is no real auth in demo mode. The admin preview is intentionally labelled and must not be treated as access control. Production requires Appwrite Auth, team membership checks on every write, rate limits on correction/contact forms, server-side validation, and a CSP. Never put an Appwrite API key in a `VITE_*` variable.
