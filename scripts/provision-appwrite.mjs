import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = path.join(root, 'docs', 'appwrite-schema.json');

const typeMap = new Map([
  ['email', {type: 'email'}],
  ['url', {type: 'url'}],
  ['datetime', {type: 'datetime'}],
  ['boolean', {type: 'boolean'}],
  ['integer', {type: 'integer'}],
  ['text', {type: 'text'}],
  ['longtext', {type: 'longtext'}],
  ['json', {type: 'longtext'}],
  ['json object', {type: 'longtext'}],
]);

export function parseAttribute(description) {
  const value = description.trim();
  const enumMatch = /^enum\[([^\]]+)\]$/u.exec(value);
  if (enumMatch) return {type: 'enum', elements: enumMatch[1].split(',').map(item => item.trim())};
  const sizedString = /^string\((\d+)\)$/u.exec(value);
  if (sizedString) return {type: 'string', size: Number(sizedString[1])};
  if (value === 'string[]') return {type: 'string', size: 180, array: true};
  const mapped = typeMap.get(value) ?? [...typeMap.entries()].find(([key]) => value.startsWith(`${key} (`))?.[1];
  if (mapped) return {...mapped};
  const sizedText = /^text\((\d+)\)$/u.exec(value);
  if (sizedText) return {type: Number(sizedText[1]) > 65535 ? 'longtext' : 'text'};
  throw new Error(`Unsupported schema attribute descriptor: ${value}`);
}

export function validateEndpoint(value, {allowSelfHosted = false} = {}) {
  const endpoint = value?.trim();
  if (!endpoint) throw new Error('APPWRITE_ENDPOINT is required');
  let parsed;
  try { parsed = new URL(endpoint); } catch { throw new Error('APPWRITE_ENDPOINT must be a valid HTTPS URL'); }
  const officialHost = parsed.hostname === 'cloud.appwrite.io' || parsed.hostname.endsWith('.cloud.appwrite.io');
  const exactPath = parsed.pathname === '/v1' && !parsed.search && !parsed.hash && !parsed.username && !parsed.password && (!parsed.port || parsed.port === '443');
  if (parsed.protocol !== 'https:' || !exactPath || (!officialHost && !allowSelfHosted)) {
    throw new Error('APPWRITE_ENDPOINT must be an official Appwrite Cloud HTTPS endpoint ending exactly in /v1; set the documented self-hosted opt-in for a private endpoint');
  }
  return endpoint;
}

export function assertColumnCompatible(existing, expected, label = 'column') {
  const property = ['type', 'size', 'array', 'required', 'default', 'elements'].find(key => JSON.stringify(existing[key] ?? null) !== JSON.stringify(expected[key] ?? null));
  if (property) throw new Error(`${label} exists with incompatible ${property}`);
}

export function assertIndexCompatible(existing, expected, label = 'index') {
  const existingColumns = existing.columns ?? existing.attributes ?? [];
  if (existing.type !== expected.type || JSON.stringify(existingColumns) !== JSON.stringify(expected.columns) || JSON.stringify(existing.orders ?? expected.columns.map(() => 'ASC')) !== JSON.stringify(expected.orders)) {
    throw new Error(`${label} exists with an incompatible definition`);
  }
}

export function assertTableCompatible(existing, expected, label = 'table') {
  if (existing.name !== expected.name || Boolean(existing.rowSecurity) !== Boolean(expected.rowSecurity) || (existing.enabled !== true && existing.enabled !== 'enabled')) {
    throw new Error(`${label} exists with incompatible name, rowSecurity, or enabled setting`);
  }
  const unexpected = (existing.permissions ?? []).filter(permission => !(expected.permissions ?? []).includes(permission));
  if (unexpected.length) throw new Error(`${label} has unexpected permissions; refusing to overwrite existing access`);
  return (expected.permissions ?? []).filter(permission => !(existing.permissions ?? []).includes(permission));
}

export function buildProvisioningPlan(schema, {databaseId, bucketId, teamName}) {
  if (!schema?.database?.id || !Array.isArray(schema.collections) || !schema.collections.length) {
    throw new Error('Schema must define a database and at least one collection');
  }
  const tables = schema.collections.map(collection => ({
    id: collection.id,
    name: collection.id,
    permissions: collection.permissions ?? [],
    rowSecurity: collection.rowSecurity ?? false,
    columns: Object.entries(collection.attributes ?? {}).map(([key, descriptor]) => ({key, required: false, ...parseAttribute(descriptor)})),
    indexes: (collection.indexes ?? []).map(index => ({...index, columns: index.columns ?? index.attributes, orders: index.orders ?? (index.columns ?? index.attributes).map(() => 'ASC')})),
  }));
  return {
    database: {id: databaseId, name: schema.database.name},
    tables,
    bucket: {id: bucketId, name: 'Laudium Post Media'},
    team: {id: 'editors', name: teamName, roles: schema.teams?.[0]?.roles ?? ['owner', 'editor', 'contributor']},
  };
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function endpointFromEnv() {
  const allowSelfHosted = process.env.APPWRITE_ALLOW_SELF_HOSTED === 'true';
  if (allowSelfHosted && !process.env.APPWRITE_SELF_HOSTED_ENDPOINT) {
    throw new Error('APPWRITE_SELF_HOSTED_ENDPOINT is required when APPWRITE_ALLOW_SELF_HOSTED=true');
  }
  const endpoint = validateEndpoint(requireEnv('APPWRITE_ENDPOINT'), {allowSelfHosted});
  if (allowSelfHosted && endpoint !== validateEndpoint(process.env.APPWRITE_SELF_HOSTED_ENDPOINT, {allowSelfHosted: true})) {
    throw new Error('APPWRITE_ENDPOINT must match the documented APPWRITE_SELF_HOSTED_ENDPOINT opt-in');
  }
  return endpoint;
}

function isNotFound(error) {
  return error?.status === 404;
}

async function request(base, project, key, method, resource, body) {
  const response = await fetch(`${base}${resource}`, {
    method,
    headers: {'X-Appwrite-Project': project, 'X-Appwrite-Key': key, 'Content-Type': 'application/json', Accept: 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    // Never include Appwrite's response body: it may contain request details or sensitive data.
    const error = new Error(`Appwrite ${method} ${resource} returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? {} : response.json();
}

async function getOrCreate(api, resource, createBody) {
  try {
    return {resource: await request(api.base, api.project, api.key, 'GET', resource), created: false};
  } catch (error) {
    if (!isNotFound(error)) throw error;
    return {resource: await request(api.base, api.project, api.key, 'POST', resource.replace(/\/[^/]+$/u, ''), createBody), created: true};
  }
}

async function ensureDatabase(api, plan) {
  const current = await getOrCreate(api, `/tablesdb/${encodeURIComponent(plan.database.id)}`, {databaseId: plan.database.id, name: plan.database.name, enabled: true});
  if (!current.created && (current.resource.name !== plan.database.name || (current.resource.enabled !== true && current.resource.enabled !== 'enabled'))) {
    throw new Error(`Database ${plan.database.id} exists with incompatible name or enabled setting`);
  }
  console.log(`database ${plan.database.id} ${current.created ? 'created' : 'ready'}`);
}

async function ensureTable(api, databaseId, table) {
  const prefix = `/tablesdb/${encodeURIComponent(databaseId)}/tables`;
  const current = await getOrCreate(api, `${prefix}/${encodeURIComponent(table.id)}`, {tableId: table.id, name: table.name, permissions: table.permissions, rowSecurity: table.rowSecurity, enabled: true});
  if (!current.created) {
    const existingPermissions = current.resource.permissions ?? [];
    const missing = assertTableCompatible(current.resource, table, `Table ${table.id}`);
    if (missing.length) await request(api.base, api.project, api.key, 'PUT', `${prefix}/${encodeURIComponent(table.id)}`, {permissions: [...existingPermissions, ...missing]});
  }
  console.log(`table ${table.id} ${current.created ? 'created' : 'ready'}`);
  return table;
}

async function ensureColumnsAndIndexes(api, databaseId, table) {
  const prefix = `/tablesdb/${encodeURIComponent(databaseId)}/tables/${encodeURIComponent(table.id)}`;
  const columns = (await request(api.base, api.project, api.key, 'GET', `${prefix}/columns`)).columns ?? [];
  for (const column of table.columns) {
    const existing = columns.find(item => item.key === column.key);
    if (existing) {
      assertColumnCompatible(existing, column, `Column ${table.id}.${column.key}`);
      continue;
    }
    const {type, ...definition} = column;
    const body = {key: column.key, required: false, array: Boolean(column.array), ...definition};
    await request(api.base, api.project, api.key, 'POST', `${prefix}/columns/${column.type}`, body);
    console.log(`column ${table.id}.${column.key} created`);
  }
  const indexes = (await request(api.base, api.project, api.key, 'GET', `${prefix}/indexes`)).indexes ?? [];
  for (const index of table.indexes) {
    const existing = indexes.find(item => item.key === index.key);
    if (existing) {
      assertIndexCompatible(existing, index, `Index ${table.id}.${index.key}`);
      continue;
    }
    await request(api.base, api.project, api.key, 'POST', `${prefix}/indexes`, {key: index.key, type: index.type, columns: index.columns, orders: index.orders});
    console.log(`index ${table.id}.${index.key} created`);
  }
}

async function ensureBucket(api, plan) {
  const resource = `/storage/buckets/${encodeURIComponent(plan.bucket.id)}`;
  const body = {bucketId: plan.bucket.id, name: plan.bucket.name, permissions: [], fileSecurity: true, enabled: true, maximumFileSize: 10 * 1024 * 1024, allowedFileExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'], compression: 'none', encryption: true, antivirus: true, transformations: true};
  const current = await getOrCreate(api, resource, body);
  if (!current.created) {
    const properties = ['name', 'permissions', 'fileSecurity', 'enabled', 'maximumFileSize', 'allowedFileExtensions', 'compression', 'encryption', 'antivirus', 'transformations'];
    const mismatch = properties.find(property => JSON.stringify(current.resource[property] ?? null) !== JSON.stringify(body[property] ?? null));
    if (mismatch) throw new Error(`Bucket ${plan.bucket.id} exists with incompatible ${mismatch}; refusing to overwrite settings`);
  }
  console.log(`bucket ${plan.bucket.id} ${current.created ? 'created' : 'ready'}`);
}

async function ensureTeam(api, plan) {
  const resource = `/teams/${encodeURIComponent(plan.team.id)}`;
  const current = await getOrCreate(api, resource, {teamId: plan.team.id, name: plan.team.name, roles: plan.team.roles});
  if (!current.created && (current.resource.name !== plan.team.name || JSON.stringify(current.resource.roles ?? []) !== JSON.stringify(plan.team.roles))) throw new Error(`Team ${plan.team.id} exists with incompatible name or roles`);
  console.log(`team ${plan.team.id} ${current.created ? 'created' : 'ready'}`);
}

export async function main({dryRun = process.argv.includes('--dry-run')} = {}) {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const databaseId = process.env.APPWRITE_DATABASE_ID || schema.database.id;
  const bucketId = process.env.APPWRITE_BUCKET_ID || 'laudium_media';
  const teamName = process.env.APPWRITE_TEAM_NAME || 'Laudium Post Editors';
  const plan = buildProvisioningPlan(schema, {databaseId, bucketId, teamName});
  if (dryRun) {
    console.log(`plan valid: database ${plan.database.id}, ${plan.tables.length} tables, bucket ${plan.bucket.id}, team ${plan.team.id}`);
    return plan;
  }
  const api = {base: endpointFromEnv(), project: requireEnv('APPWRITE_PROJECT_ID'), key: requireEnv('APPWRITE_API_KEY')};
  await ensureDatabase(api, plan);
  for (const table of plan.tables) { await ensureTable(api, plan.database.id, table); await ensureColumnsAndIndexes(api, plan.database.id, table); }
  await ensureBucket(api, plan);
  await ensureTeam(api, plan);
  console.log('provisioning complete');
  return plan;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
