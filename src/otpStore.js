import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
export function createOtpStore({ now = Date.now, maxEntries = 10000 } = {}) {
  const entries = new Map();
  const key = randomBytes(32);
  const digest = (code) => createHmac("sha256", key).update(code).digest();
  function generateOtp(userId, ttlSeconds = 300, maxInvalid = 3) {
    if (!/^\d{17,20}$/.test(userId)) throw new Error("Invalid Discord user ID");
    if (
      !Number.isInteger(ttlSeconds) ||
      ttlSeconds < 30 ||
      ttlSeconds > 900 ||
      !Number.isInteger(maxInvalid) ||
      maxInvalid < 1 ||
      maxInvalid > 10
    )
      throw new Error("Invalid OTP configuration");
    const time = now();
    for (const [id, entry] of entries)
      if (entry.expiresAt <= time) entries.delete(id);
    if (!entries.has(userId) && entries.size >= maxEntries)
      throw new Error("OTP service is busy. Please try again later.");
    const previous = entries.get(userId);
    if (previous && time - previous.generatedAt < 30000)
      throw new Error("Please wait 30 seconds before requesting another code.");
    const code = String(randomInt(0, 1000000)).padStart(6, "0");
    entries.set(userId, {
      hash: digest(code),
      expiresAt: time + ttlSeconds * 1000,
      generatedAt: time,
      attempts: 0,
      maxInvalid,
      valid: true,
    });
    return code;
  }
  function validateOtp(userId, code) {
    const entry = entries.get(userId);
    if (!entry) return { ok: false, reason: "missing" };
    if (now() >= entry.expiresAt) {
      entry.valid = false;
      return { ok: false, reason: "expired" };
    }
    if (!entry.valid) return { ok: false, reason: "invalidated" };
    if (
      typeof code === "string" &&
      /^\d{6}$/.test(code) &&
      timingSafeEqual(entry.hash, digest(code))
    ) {
      entry.valid = false;
      return { ok: true };
    }
    entry.attempts++;
    if (entry.attempts >= entry.maxInvalid) {
      entry.valid = false;
      return { ok: false, reason: "too_many_attempts" };
    }
    return {
      ok: false,
      reason: "mismatch",
      attemptsLeft: entry.maxInvalid - entry.attempts,
    };
  }
  function getStatus(userId) {
    const entry = entries.get(userId);
    return entry
      ? {
          expiresAt: entry.expiresAt,
          attempts: entry.attempts,
          valid: entry.valid && now() < entry.expiresAt,
        }
      : null;
  }
  function invalidateOtp(userId) {
    const entry = entries.get(userId);
    if (entry) entry.valid = false;
  }
  return { generateOtp, validateOtp, getStatus, invalidateOtp };
}
export const { generateOtp, validateOtp, getStatus, invalidateOtp } =
  createOtpStore();
