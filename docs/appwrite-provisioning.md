# One-time Appwrite provisioning

`.github/workflows/provision-appwrite.yml` is a manual, repeatable bootstrap for the database, TablesDB tables, schema columns/indexes, media bucket, and `editors` team described in `docs/appwrite-schema.json`. It uses the Appwrite REST API because the installed `appwrite@17.0.2` web SDK does not expose the current TablesDB administration service. The REST paths and request shapes follow Appwrite's current TablesDB, Storage, and Teams server API references.

The workflow is deliberately non-destructive: it gets resources by their explicit IDs, creates missing resources, adds only missing declared permissions, and refuses incompatible existing settings, columns, indexes, or row-security configuration. It never overwrites existing settings or deletes data/resources. Job output contains only resource IDs and status; the API key is never passed to frontend code, committed, or printed.

Appwrite's current TablesDB API exposes typed text/string/number/date columns but not the Documents API's JSON column type. The schema explicitly represents JSON-string fields as optional `text(65535)` columns while allowing an existing `longtext` only for those named fields; the application contract is `JSON.stringify` on writes and safe `JSON.parse` on reads. Article `body` is a JSON-serialized string array; `public_ads.media` and `public_ads.contacts` are JSON-serialized objects. Malformed structured text is rejected at the public adapter boundary (empty article body, no media, and no contacts), never rendered as trusted data. `string[]` is a string column with `array: true`. Deprecated `string(30000)` body descriptors are not used. All fields carry explicit required/optional and default metadata; provisioning refuses unrelated type, size, array, enum, index, permission, or row-security drift.

The `editors` team's roles (`owner`, `editor`, `contributor`) are create-time/documented configuration. Appwrite's `GET /teams/{teamId}` response does not expose roles, so repeat provisioning validates only the existing team name and never fails because roles are absent or attempts to overwrite them.

## Run it

1. In GitHub, open **Actions → Provision Appwrite**.
2. Click **Run workflow**. The job checks out protected `main` for the provisioning script, regardless of the dispatcher's selected ref. Configure the required `appwrite-production` GitHub Environment with required reviewers before using the workflow.
3. Enter the Appwrite **Project ID**. Keep the defaults for `database_id` (`laudium_post`), `bucket_id` (`laudium_media`), and team name unless this project intentionally uses different IDs/naming. Set `endpoint` to an official Appwrite Cloud regional endpoint (for example, `https://fra.cloud.appwrite.io/v1`); use the exact HTTPS `/v1` path. Arbitrary/self-hosted endpoints are rejected by default; the script's documented `APPWRITE_ALLOW_SELF_HOSTED=true` plus matching `APPWRITE_SELF_HOSTED_ENDPOINT` opt-in is for an operator-run, separately reviewed invocation only and is not enabled by this workflow.
4. Click **Run workflow**, open the run, and confirm the validation step passes before reviewing the provisioning status lines.
5. The temporary `APPWRITE_API_KEY` must have only the required database, bucket, and team write/read scopes. After the run succeeds (or after investigating a failed run), revoke/delete that temporary key in the Appwrite Console. Create a narrowly scoped replacement only when an ongoing server process needs one.

The key is stored only as the GitHub repository secret `APPWRITE_API_KEY`. Do not put it in `.env`, any `VITE_*` variable, workflow input, logs, issue, or pull request. GitHub masks the secret, but the script also avoids printing Appwrite response bodies.

The workflow does not add the IDs to deployment configuration. After provisioning, set the public `VITE_APPWRITE_*` IDs separately as documented in `docs/appwrite-setup.md`; never set `APPWRITE_API_KEY` in frontend or Vercel client environment variables.
