import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildProvisioningPlan, parseAttribute, validateEndpoint, assertColumnCompatible, assertIndexCompatible, assertTableCompatible, assertTableSchemaCompatible, assertTeamCompatible} from './provision-appwrite.mjs';
import schema from '../docs/appwrite-schema.json' with {type: 'json'};

test('schema maps to a complete TablesDB plan without secrets or deletes', () => {
  const plan = buildProvisioningPlan(schema, {databaseId: 'laudium_post', bucketId: 'laudium_media', teamName: 'Editors'});
  assert.equal(plan.tables.length, 7);
  assert.equal(plan.tables.find(table => table.id === 'public_articles').indexes.length, 4);
  assert.deepEqual(parseAttribute('enum[Draft,Published]'), {type: 'enum', elements: ['Draft', 'Published']});
  assert.equal(plan.bucket.id, 'laudium_media');
  assert.equal(plan.team.id, 'editors');
});

test('schema can be applied to an explicitly chosen database ID', () => {
  const plan = buildProvisioningPlan(schema, {databaseId: 'other', bucketId: 'media', teamName: 'Editors'});
  assert.equal(plan.database.id, 'other');
});

test('endpoint validation rejects malicious or imprecise workflow targets', () => {
  assert.equal(validateEndpoint('https://fra.cloud.appwrite.io/v1'), 'https://fra.cloud.appwrite.io/v1');
  for (const endpoint of ['https://evil.example/v1', 'https://cloud.appwrite.io.evil.example/v1', 'http://cloud.appwrite.io/v1', 'https://cloud.appwrite.io/v1/extra', 'https://cloud.appwrite.io/v1?redirect=evil']) {
    assert.throws(() => validateEndpoint(endpoint), /official Appwrite Cloud/);
  }
  assert.equal(validateEndpoint('https://private.example/v1', {allowSelfHosted: true}), 'https://private.example/v1');
});

test('provisioning is pinned to main and requires an approval environment', async () => {
  const workflow = await readFile(new URL('../.github/workflows/provision-appwrite.yml', import.meta.url), 'utf8');
  assert.match(workflow, /ref:\s*main/);
  assert.match(workflow, /environment:\s*appwrite-production/);
  assert.doesNotMatch(workflow, /ref:\s*\$\{\{\s*inputs\./);
});

test('existing row security, permissions, and schema drift fail closed', () => {
  assert.throws(() => assertTableCompatible({name: 'articles', rowSecurity: true, enabled: true, permissions: ['read("any")']}, {name: 'articles', rowSecurity: false, permissions: ['read("any")']}), /rowSecurity/);
  assert.throws(() => assertTableCompatible({name: 'articles', rowSecurity: false, enabled: true, permissions: ['read("any")', 'delete("any")']}, {name: 'articles', rowSecurity: false, permissions: ['read("any")']}), /unexpected permissions/);
  assert.deepEqual(assertTableCompatible({name: 'articles', rowSecurity: false, enabled: true, permissions: []}, {name: 'articles', rowSecurity: false, permissions: ['read("any")']}), ['read("any")']);
  assert.throws(() => assertColumnCompatible({type: 'enum', elements: ['Draft', 'Published'], required: false}, {type: 'enum', elements: ['Draft', 'Live'], required: false}), /elements/);
  assert.throws(() => assertColumnCompatible({type: 'string', size: 120, array: false, required: false}, {type: 'string', size: 140, array: false, required: false}), /size/);
  assert.throws(() => assertColumnCompatible({type: 'longtext', array: false, required: true}, {type: 'string', size: 140, array: false, required: true}), /type/);
  assert.throws(() => assertIndexCompatible({type: 'key', columns: ['publishedAt', '$id'], orders: ['ASC', 'ASC']}, {type: 'key', columns: ['publishedAt', '$id'], orders: ['DESC', 'DESC']}), /incompatible/);
});

test('unexpected columns are rejected on every declared table, including public tables', () => {
  assert.throws(() => assertTableSchemaCompatible(
    [{key: 'title'}, {key: 'unreviewedColumn'}],
    [{key: 'title'}],
    [],
    [],
    'public_articles',
  ), /unexpected keys: unreviewedColumn/);
  assert.doesNotThrow(() => assertTableSchemaCompatible(
    [{key: 'title'}],
    [{key: 'title'}],
    [],
    [],
    'public_articles',
  ));
});

test('unexpected indexes are rejected on every declared table, including public tables', () => {
  assert.throws(() => assertTableSchemaCompatible(
    [],
    [],
    [{key: 'articles_title_search'}, {key: 'unreviewed_index'}],
    [{key: 'articles_title_search'}],
    'public_articles',
  ), /unexpected keys: unreviewed_index/);
  assert.doesNotThrow(() => assertTableSchemaCompatible(
    [],
    [],
    [{key: 'articles_title_search'}],
    [{key: 'articles_title_search'}],
    'public_articles',
  ));
});

test('team reruns do not compare roles omitted by the Teams GET response', () => {
  assert.doesNotThrow(() => assertTeamCompatible({name: 'Editors'}, {name: 'Editors', roles: ['owner', 'editor', 'contributor']}));
  assert.throws(() => assertTeamCompatible({name: 'Other'}, {name: 'Editors', roles: ['owner']}), /incompatible name/);
});

test('manual public table definitions are accepted without weakening field or security contracts', () => {
  const plan = buildProvisioningPlan(schema, {databaseId: 'laudium_post', bucketId: 'laudium_media', teamName: 'Editors'});
  const articles = plan.tables.find(table => table.id === 'public_articles');
  const ads = plan.tables.find(table => table.id === 'public_ads');
  const body = articles.columns.find(column => column.key === 'body');
  const media = ads.columns.find(column => column.key === 'media');
  assert.equal(parseAttribute('text(65535)').type, 'text');
  assert.deepEqual({required: body.required, default: body.default, type: body.type, size: body.size, compatibleTypes: body.compatibleTypes}, {required: true, default: null, type: 'text', size: 65535, compatibleTypes: ['text', 'longtext']});
  assert.deepEqual({required: media.required, default: media.default, type: media.type, size: media.size, compatibleTypes: media.compatibleTypes}, {required: false, default: null, type: 'text', size: 65535, compatibleTypes: ['text', 'longtext']});
  assert.equal(ads.columns.find(column => column.key === 'active').default, false);
  assert.equal(ads.columns.find(column => column.key === 'priority').default, 0);
  assert.equal(plan.tables.find(table => table.id === 'public_categories').columns.find(column => column.key === 'active').default, true);
  assert.doesNotThrow(() => assertColumnCompatible({type: 'text', size: 65535, array: false, required: true, default: null}, body));
  assert.doesNotThrow(() => assertColumnCompatible({type: 'longtext', array: false, required: true, default: null}, body));
  assert.throws(() => assertColumnCompatible({type: 'text', size: 65534, array: false, required: true, default: null}, body), /size/);
  assert.throws(() => assertColumnCompatible({type: 'text', size: 65535, array: true, required: false, default: null}, media), /array/);
});
