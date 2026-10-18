import {mediaPermissionDecision, PUBLIC_READ, hasAllowedMediaType} from './policy.mjs';

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function header(headers, name) {
  return Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

function config() {
  return {
    endpoint: requiredEnv('APPWRITE_ENDPOINT').replace(/\/$/u, ''),
    project: requiredEnv('APPWRITE_PROJECT_ID'),
    key: requiredEnv('APPWRITE_API_KEY'),
    bucket: requiredEnv('APPWRITE_MEDIA_BUCKET_ID'),
    team: requiredEnv('APPWRITE_EDITORS_TEAM_ID'),
    database: requiredEnv('APPWRITE_DATABASE_ID'),
    articleSourceTable: requiredEnv('APPWRITE_ARTICLE_SOURCE_TABLE_ID'),
    advertiserSourceTable: requiredEnv('APPWRITE_ADVERTISER_SOURCE_TABLE_ID'),
  };
}

async function appwriteRequest(settings, method, resource, body) {
  const response = await (settings.fetcher ?? fetch)(`${settings.endpoint}${resource}`, {
    method,
    headers: {'X-Appwrite-Project': settings.project, 'X-Appwrite-Key': settings.key, 'Content-Type': 'application/json', Accept: 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error(`Appwrite ${method} ${resource} returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? {} : response.json();
}

async function memberships(settings) {
  const response = await appwriteRequest(settings, 'GET', `/teams/${encodeURIComponent(settings.team)}/memberships?limit=100`);
  return response.memberships ?? [];
}

function sourceTable(settings, sourceType) {
  if (sourceType === 'article') return settings.articleSourceTable;
  if (sourceType === 'advertisement') return settings.advertiserSourceTable;
  return undefined;
}

async function sourceRecord(settings, sourceType, sourceId) {
  const table = sourceTable(settings, sourceType);
  if (!table || !sourceId) return undefined;
  try {
    return await appwriteRequest(settings, 'GET', `/tablesdb/${encodeURIComponent(settings.database)}/tables/${encodeURIComponent(table)}/rows/${encodeURIComponent(sourceId)}`);
  } catch (error) {
    if (error.status === 404) return undefined;
    throw error;
  }
}

export async function executePublication({body, headers = {}}, settings = config()) {
  const input = typeof body === 'string' ? JSON.parse(body) : body ?? {};
  const userId = header(headers, 'x-appwrite-user-id');
  const source = await sourceRecord(settings, input.sourceType, input.sourceId);
  const decision = mediaPermissionDecision({userId, memberships: await memberships(settings), ...input, source});
  if (!decision.allowed) return {statusCode: 403, body: {error: decision.reason}};
  const filePath = `/storage/buckets/${encodeURIComponent(settings.bucket)}/files/${encodeURIComponent(input.fileId)}`;
  const file = await appwriteRequest(settings, 'GET', filePath);
  if (input.action === 'publish' && !hasAllowedMediaType(file.name, file.mimeType)) return {statusCode: 422, body: {error: 'file type is not allowed'}};
  const current = file.permissions ?? [];
  const permissions = input.action === 'publish'
    ? [...new Set([...current, PUBLIC_READ])]
    : current.filter(permission => permission !== PUBLIC_READ);
  await appwriteRequest(settings, 'PUT', filePath, {fileId: input.fileId, name: file.name, permissions});
  return {statusCode: 200, body: {fileId: input.fileId, action: input.action, public: permissions.includes(PUBLIC_READ)}};
}

export default async function main(req, res) {
  try {
    const result = await executePublication({body: req.bodyJson ?? req.body, headers: req.headers}, config());
    return res.json(result.body, result.statusCode);
  } catch (error) {
    console.error(error.message);
    return res.json({error: 'publication service unavailable'}, 500);
  }
}
