# Exotics Café Discord sign-in

[Complete project setup and operations cheatsheet](https://github.com/cristiancringasu/exoah-api/blob/main/CHEATSHEET.md) — available to the private API repository's collaborators. It covers all four projects, configuration, deployment, backups and useful commands. Credentials stay outside Git.

Node 24 Discord bot and private HTTP OTP verifier. Codes are cryptographically generated, hashed in memory, expire, have a bounded attempt count, and can be used once. A process restart invalidates outstanding codes.

Run `npm ci`, copy `.env.example` to `.env`, and fill the bot token, application ID and a random shared secret of at least 32 characters. The API's `DISCORD_SHARED_SECRET` must match. Keep the populated file private.

`npm start` connects the bot. `/otp` sends the requesting user a direct message. Users must permit DMs from the Discord server. Normal startup does not change registered commands. Run `npm run register:commands` explicitly if `/otp` is missing; `GUILD_ID` scopes registration to a test server when set. The registration command upserts only `/otp`.

The verification endpoint must remain private, accessible only to the API. `/health/ready` succeeds only after Discord connects. See the API repository's `deploy/README.md` for the shared Docker Compose deployment.

`npm test` runs offline expiry, replay, attempt-limit, cooldown and HTTP authorization tests without contacting Discord. `npm run format:check` and `npm audit --audit-level=moderate` run the remaining checks. A production smoke test with a real Discord account is still required after deployment.

## Private profile lookup

`POST /lookup-user` uses the same private shared secret as the OTP verifier, validates the Discord ID, and returns only the ID, username, display name and avatar URL. The API restricts requests to existing site accounts. The bot's bounded ten-minute cache limits Discord requests; this feature needs no privileged gateway intent. User email, messages, membership and roles are not returned.

The `/otp` message also includes the requesting user's Discord username and numeric ID to make registration easier. It is still generated only when that user invokes the command.
