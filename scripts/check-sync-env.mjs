import { pathToFileURL } from 'node:url';

// Only report key names. Credential values must never enter the runner log.
export function missingSyncSecrets(env) {
  const required = [
    'DATABASE_URL',
    'GOOGLE_KIS_SERVICE_ACCOUNT_JSON',
    'GOOGLE_KIS_BUCKET_NAME',
    'APPLE_KIS_ISSUER_ID',
    'APPLE_KIS_KEY_ID',
    'APPLE_KIS_PRIVATE_KEY',
  ];
  if ((env.SYNC_SCOPE ?? 'all') !== 'voc') {
    required.push('APPLE_KIS_VENDOR_NUMBER', 'GA4_KIS_PROPERTY_ID');
  }
  return required.filter(key => !env[key]?.trim());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const missing = missingSyncSecrets(process.env);
  if (missing.length) {
    console.error(`::error title=Missing synchronization secrets::Configure these repository Actions secrets: ${missing.join(', ')}. Local .env files are not available on GitHub runners.`);
    process.exitCode = 1;
  } else {
    console.info('Required synchronization secrets are configured.');
  }
}
