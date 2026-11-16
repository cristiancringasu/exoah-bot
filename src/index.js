import "dotenv/config";
import { Client, GatewayIntentBits, Events } from "discord.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createApp } from "./app.js";
import { generateOtp, invalidateOtp } from "./otpStore.js";
export async function start() {
  const {
    DISCORD_TOKEN,
    SHARED_SECRET,
    PORT = "3020",
    HOST = "127.0.0.1",
    OTP_TTL_SECONDS = "300",
    MAX_INVALID_ATTEMPTS = "3",
  } = process.env;
  if (!DISCORD_TOKEN) throw new Error("DISCORD_TOKEN is required");
  const ttl = Number(OTP_TTL_SECONDS);
  const maxAttempts = Number(MAX_INVALID_ATTEMPTS);
  if (
    !Number.isInteger(ttl) ||
    ttl < 30 ||
    ttl > 900 ||
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > 10
  )
    throw new Error("Invalid OTP expiry or attempt limit");
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const profiles = new Map();
  const app = createApp({
    lookup: async (userId) => {
      const cached = profiles.get(userId);
      if (cached && cached.expires > Date.now()) return cached.value;
      const user = await client.users.fetch(userId, {
        force: true,
        cache: false,
      });
      if (!user || user.bot) return null;
      const value = {
        id: user.id,
        username:
          user.discriminator && user.discriminator !== "0"
            ? `${user.username}#${user.discriminator}`
            : user.username,
        displayName: user.globalName || user.username,
        avatarUrl: user.displayAvatarURL({ extension: "png", size: 128 }),
      };
      if (profiles.size >= 5000) profiles.delete(profiles.keys().next().value);
      profiles.set(userId, { value, expires: Date.now() + 600000 });
      return value;
    },
    sharedSecret: SHARED_SECRET,
    ready: () => client.isReady(),
  });
  client.once(Events.ClientReady, () =>
    console.log("Discord OTP bot connected"),
  );
  client.on(Events.Error, (error) =>
    console.error("Discord client error:", error.name),
  );
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== "otp")
      return;
    try {
      await interaction.deferReply({ flags: 64 });
      const code = generateOtp(interaction.user.id, ttl, maxAttempts);
      try {
        await interaction.user.send(
          `Your Exoah sign-in code is: ${code}. Discord username: @${interaction.user.username}. User ID: ${interaction.user.id}. It expires in ${Math.round(ttl / 60)} minutes and can be used once. Never share it.`,
        );
      } catch {
        invalidateOtp(interaction.user.id);
        throw new Error(
          "Enable direct messages from this server and request a new code.",
        );
      }
      await interaction.editReply(
        "A sign-in code has been sent to your direct messages.",
      );
    } catch (error) {
      const message =
        error.message.includes("30 seconds") ||
        error.message.startsWith("Enable direct")
          ? error.message
          : "A code could not be sent. Please try again shortly.";
      if (interaction.deferred)
        await interaction.editReply(message).catch(() => {});
      else
        await interaction
          .reply({ content: message, flags: 64 })
          .catch(() => {});
    }
  });
  await client.login(DISCORD_TOKEN);
  const server = app.listen(Number(PORT), HOST, () =>
    console.log(`OTP service listening on ${HOST}:${PORT}`),
  );
  const shutdown = () => {
    client.destroy();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  return { client, server };
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
)
  start().catch((error) => {
    console.error(
      "Bot startup failed:",
      error.name,
      "Check the bot environment.",
    );
    process.exit(1);
  });
