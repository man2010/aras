const applicationUrl = process.env.ARAS_APPLICATION_URL?.trim().replace(/\/$/, '');
const secret = process.env.PHOTO_AUDIT_CRON_SECRET;

if (!applicationUrl || !secret) {
  throw new Error('ARAS_APPLICATION_URL and PHOTO_AUDIT_CRON_SECRET are required.');
}

let profileOffset = 0;
let photosScanned = 0;
let flaggedCount = 0;
let errorCount = 0;
let batches = 0;

while (batches++ < 10_000) {
  const response = await fetch(`${applicationUrl}/api/admin/fake-profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-aras-photo-audit-secret': secret,
    },
    body: JSON.stringify({ action: 'scan', profileOffset }),
    signal: AbortSignal.timeout(310_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Photo audit failed (HTTP ${response.status}): ${result.error || 'unknown error'}`);
  }

  photosScanned += result.photosScanned ?? 0;
  flaggedCount += result.flaggedCount ?? 0;
  errorCount += result.errorCount ?? 0;
  profileOffset = result.profileOffset ?? profileOffset;

  if (!result.hasMore) break;
}

if (batches > 10_000) throw new Error('Photo audit exceeded the batch safety limit.');
console.log(`Photo audit completed: ${photosScanned} photos scanned, ${flaggedCount} flagged, ${errorCount} errors.`);
