# One-time Appwrite provisioning

`.github/workflows/provision-appwrite.yml` is a manual, repeatable bootstrap for the database, TablesDB tables, schema columns/indexes, media bucket, and `editors` team described in `docs/appwrite-schema.json`. It uses the Appwrite REST API because the installed `appwrite@17.0.2` web SDK does not expose the current TablesDB administration service. The REST paths and request shapes follow Appwrite's current TablesDB, Storage, and Teams server API references.

The workflow is deliberately non-destructive: it gets resources by their explicit IDs, creates missing resources, updates only names/permissions and safe bucket/database settings, and refuses incompatible existing columns/indexes. It never deletes data or resources. Job output contains only resource IDs and status; the API key is never passed to frontend code, committed, or printed.

Appwrite's current TablesDB API exposes typed text/string/number/date columns but not the Documents API's JSON column type. Schema `json`/`json object` fields are therefore provisioned as `longtext` (the JSON representation remains the application contract); `string[]` is a string column with `array: true`. This is validated by the dry-run plan and avoids relying on an unsupported endpoint.

## Run it

1. In GitHub, open **Actions → Provision Appwrite**.
2. Click **Run workflow** and choose the branch containing this workflow.
3. Enter the Appwrite **Project ID**. Keep the defaults for `database_id` (`laudium_post`), `bucket_id` (`laudium_media`), and team name unless this project intentionally uses different IDs/naming. Set `endpoint` to the project's Appwrite region endpoint when applicable (for example, `https://fra.cloud.appwrite.io/v1`); use HTTPS.
4. Click **Run workflow**, open the run, and confirm the validation step passes before reviewing the provisioning status lines.
5. The temporary `APPWRITE_API_KEY` must have only the required database, bucket, and team write/read scopes. After the run succeeds (or after investigating a failed run), revoke/delete that temporary key in the Appwrite Console. Create a narrowly scoped replacement only when an ongoing server process needs one.

The key is stored only as the GitHub repository secret `APPWRITE_API_KEY`. Do not put it in `.env`, any `VITE_*` variable, workflow input, logs, issue, or pull request. GitHub masks the secret, but the script also avoids printing Appwrite response bodies.

The workflow does not add the IDs to deployment configuration. After provisioning, set the public `VITE_APPWRITE_*` IDs separately as documented in `docs/appwrite-setup.md`; never set `APPWRITE_API_KEY` in frontend or Vercel client environment variables.
