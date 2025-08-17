// Simple in-memory OTP store. Could be swapped for Redis in production.
// Structure: { userId: { code, expiresAt, attempts, valid } }

const store = new Map();

export function generateOtp(userId, ttlSeconds, maxInvalid) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  store.set(userId, { code, expiresAt, attempts: 0, maxInvalid, valid: true });
  console.log(`Generated OTP for user ${userId}: ${code}, expires at ${new Date(expiresAt).toISOString()}`);
  return code;
}

export function validateOtp(userId, code) {
  const entry = store.get(userId);
  console.log(`Validating OTP for user ${userId}, entry ${entry}, code ${code}`);
  if (!entry) return { ok: false, reason: 'missing' };
  if (!entry.valid) return { ok: false, reason: 'invalidated' };
  if (Date.now() > entry.expiresAt) {
    entry.valid = false;
    return { ok: false, reason: 'expired' };
  }
  if (entry.code === code) {
    // Invalidate after success
    entry.valid = false;
    return { ok: true };
  }
  entry.attempts += 1;
  if (entry.attempts >= entry.maxInvalid) {
    entry.valid = false;
    return { ok: false, reason: 'too_many_attempts' };
  }
  return { ok: false, reason: 'mismatch', attemptsLeft: entry.maxInvalid - entry.attempts };
}

export function invalidateOtp(userId) {
  const entry = store.get(userId);
  if (entry) entry.valid = false;
}

export function getStatus(userId) {
  const entry = store.get(userId);
  if (!entry) return null;
  return { ...entry };
}
