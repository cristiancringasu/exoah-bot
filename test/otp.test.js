import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createOtpStore } from "../src/otpStore.js";
import { createApp } from "../src/app.js";
const user = "100000000000000001";
const secret = "a-local-test-shared-secret-over-32-characters";
test("codes are six digits, work once and are never exposed through status", () => {
  const store = createOtpStore();
  const code = store.generateOtp(user);
  assert.match(code, /^\d{6}$/);
  assert.equal(store.getStatus(user).code, undefined);
  assert.deepEqual(store.validateOtp(user, code), { ok: true });
  assert.equal(store.validateOtp(user, code).ok, false);
});
test("expired and invalidated codes cannot authenticate", () => {
  let time = 0;
  const store = createOtpStore({ now: () => time });
  const code = store.generateOtp(user, 30);
  time = 30000;
  assert.equal(store.validateOtp(user, code).reason, "expired");
  time = 60000;
  const fresh = store.generateOtp(user);
  store.invalidateOtp(user);
  assert.equal(store.validateOtp(user, fresh).reason, "invalidated");
});
test("incorrect attempts lock the code at the configured limit", () => {
  const store = createOtpStore();
  const code = store.generateOtp(user, 300, 3);
  const wrong = code === "000000" ? "111111" : "000000";
  assert.equal(store.validateOtp(user, wrong).attemptsLeft, 2);
  assert.equal(store.validateOtp(user, wrong).attemptsLeft, 1);
  assert.equal(store.validateOtp(user, wrong).reason, "too_many_attempts");
  assert.equal(store.validateOtp(user, code).ok, false);
});
test("generation has a per-user cooldown and a bounded active store", () => {
  const store = createOtpStore({ now: () => 0, maxEntries: 1 });
  store.generateOtp(user);
  assert.throws(() => store.generateOtp(user), /30 seconds/);
  assert.throws(() => store.generateOtp("100000000000000002"), /busy/);
});
test("invalid settings and non-Discord identifiers are rejected", () => {
  const store = createOtpStore();
  assert.throws(() => store.generateOtp("__proto__"));
  assert.throws(() => store.generateOtp(user, 0));
  assert.throws(() => store.generateOtp(user, 300, 0));
  assert.throws(() => createApp({ sharedSecret: "short" }));
});
test("the internal verifier requires the shared secret and hides the old debug endpoint", async () => {
  const store = createOtpStore();
  const code = store.generateOtp(user);
  const app = createApp({ sharedSecret: secret, validate: store.validateOtp });
  assert.equal(
    (await request(app).post("/verify-otp").send({ userId: user, code }))
      .status,
    403,
  );
  assert.equal((await request(app).get(`/otp-status/${user}`)).status, 404);
  assert.equal(
    (
      await request(app)
        .post("/verify-otp")
        .send({ userId: user, code, secret })
    ).body.ok,
    true,
  );
  assert.equal(
    (
      await request(app)
        .post("/verify-otp")
        .send({ userId: user, code, secret })
    ).body.ok,
    false,
  );
});
test("a disconnected bot fails closed and readiness reports its state", async () => {
  const app = createApp({ sharedSecret: secret, ready: () => false });
  assert.equal((await request(app).get("/health/live")).status, 200);
  assert.equal((await request(app).get("/health/ready")).status, 503);
  assert.equal(
    (
      await request(app)
        .post("/verify-otp")
        .send({ userId: user, code: "123456", secret })
    ).status,
    503,
  );
});
test("profile lookup requires the private secret and exposes only public profile fields", async () => {
  let calls = 0;
  const app = createApp({
    sharedSecret: secret,
    lookup: async (id) => {
      calls++;
      return {
        id,
        username: "seller",
        displayName: "Seller",
        avatarUrl: "https://cdn.discordapp.com/avatar.png",
        email: "private@example.test",
      };
    },
  });
  assert.equal(
    (await request(app).post("/lookup-user").send({ userId: user })).status,
    403,
  );
  assert.equal(calls, 0);
  assert.equal(
    (
      await request(app)
        .post("/lookup-user")
        .send({ userId: "../private", secret })
    ).status,
    400,
  );
  const response = await request(app)
    .post("/lookup-user")
    .send({ userId: user, secret });
  assert.equal(response.status, 200);
  assert.equal(response.body.id, user);
  assert.equal(response.body.email, undefined);
  const disconnected = createApp({ sharedSecret: secret, ready: () => false });
  assert.equal(
    (
      await request(disconnected)
        .post("/lookup-user")
        .send({ userId: user, secret })
    ).status,
    503,
  );
});
