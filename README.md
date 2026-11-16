# Exotics Café Discord sign-in

Node 24 Discord bot and private HTTP OTP verifier. Codes are cryptographically generated, hashed in memory, expire, have a bounded attempt count, and can be used once. A process restart invalidates outstanding codes.

Run `npm ci`, copy `.env.example` to `.env`, and fill the bot token, application ID and a random shared secret of at least 32 characters. The API's `DISCORD_SHARED_SECRET` must match. Keep the populated file private.

`npm start` connects the bot. `/otp` sends the requesting user a direct message. Users must permit DMs from the Discord server. Normal startup does not change registered commands. Run `npm run register:commands` explicitly if `/otp` is missing; `GUILD_ID` scopes registration to a test server when set. The registration command upserts only `/otp`.

The verification endpoint must remain private, accessible only to the API. `/health/ready` succeeds only after Discord connects. See the API repository's `deploy/README.md` for the shared Docker Compose deployment.

`npm test` runs offline expiry, replay, attempt-limit, cooldown and HTTP authorization tests without contacting Discord. `npm run format:check` and `npm audit --audit-level=moderate` run the remaining checks. A production smoke test with a real Discord account is still required after deployment.
