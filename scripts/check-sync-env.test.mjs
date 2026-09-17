import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingSyncSecrets } from './check-sync-env.mjs';

test('lists all missing keys without credential values', () => {
  const keys = missingSyncSecrets({ DATABASE_URL: 'private-connection-value' });
  assert.equal(keys.includes('DATABASE_URL'), false);
  assert.equal(keys.includes('GOOGLE_KIS_SERVICE_ACCOUNT_JSON'), true);
  assert.equal(keys.includes('GA4_KIS_PROPERTY_ID'), true);
  assert.equal(JSON.stringify(keys).includes('private-connection-value'), false);
});
test('rejects whitespace and checks only relevant secrets for VOC', () => {
  const missing = missingSyncSecrets({ SYNC_SCOPE: 'voc', DATABASE_URL: '  ' });
  assert.equal(missing.includes('DATABASE_URL'), true);
  assert.equal(missing.includes('APPLE_KIS_VENDOR_NUMBER'), false);
  assert.equal(missing.includes('GA4_KIS_PROPERTY_ID'), false);
});
test('accepts configured synchronization without optional AI credentials', () => {
  const env = Object.fromEntries(missingSyncSecrets({}).map(key => [key, 'configured']));
  assert.deepEqual(missingSyncSecrets(env), []);
});
