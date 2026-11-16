import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { timingSafeEqual } from "node:crypto";
import { validateOtp } from "./otpStore.js";
export function createApp({
  sharedSecret,
  validate = validateOtp,
  ready = () => true,
  lookup = async () => null,
} = {}) {
  if (typeof sharedSecret !== "string" || sharedSecret.length < 32)
    throw new Error("SHARED_SECRET must contain at least 32 characters");
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "2kb" }));
  app.get("/health/live", (_req, res) => res.json({ ok: true }));
  app.get("/health/ready", (_req, res) =>
    res.status(ready() ? 200 : 503).json({ ok: ready() }),
  );
  app.post(
    "/lookup-user",
    rateLimit({
      windowMs: 60000,
      limit: 60,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    async (req, res) => {
      const { userId, secret } = req.body || {};
      const candidate =
        typeof secret === "string" ? Buffer.from(secret) : Buffer.alloc(0);
      const expected = Buffer.from(sharedSecret);
      if (
        candidate.length !== expected.length ||
        !timingSafeEqual(candidate, expected)
      )
        return res.status(403).json({ error: "forbidden" });
      if (typeof userId !== "string" || !/^\d{17,20}$/.test(userId))
        return res.status(400).json({ error: "Invalid user ID" });
      if (!ready())
        return res
          .status(503)
          .json({ error: "Discord connection unavailable" });
      try {
        const user = await lookup(userId);
        if (!user)
          return res.status(404).json({ error: "Discord account unavailable" });
        res.json({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        });
      } catch {
        res.status(503).json({ error: "Discord profile lookup unavailable" });
      }
    },
  );
  app.post(
    "/verify-otp",
    rateLimit({
      windowMs: 60000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    (req, res) => {
      const { userId, code, secret } = req.body || {};
      const candidate =
        typeof secret === "string" ? Buffer.from(secret) : Buffer.alloc(0);
      const expected = Buffer.from(sharedSecret);
      if (
        candidate.length !== expected.length ||
        !timingSafeEqual(candidate, expected)
      )
        return res.status(403).json({ error: "forbidden" });
      if (
        typeof userId !== "string" ||
        !/^\d{17,20}$/.test(userId) ||
        typeof code !== "string" ||
        !/^\d{6}$/.test(code)
      )
        return res.status(400).json({ error: "Invalid user ID or code" });
      if (!ready())
        return res
          .status(503)
          .json({ error: "Discord connection unavailable" });
      return res.json(validate(userId, code));
    },
  );
  app.use((_req, res) => res.status(404).json({ error: "not_found" }));
  app.use((error, _req, res, _next) =>
    res
      .status(error.status === 413 ? 413 : 400)
      .json({ error: "Invalid request" }),
  );
  return app;
}
