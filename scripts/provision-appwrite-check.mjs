import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProvisioningPlan, parseAttribute} from './provision-appwrite.mjs';
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
