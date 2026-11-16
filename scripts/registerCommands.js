import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID)
  throw new Error("DISCORD_TOKEN and CLIENT_ID are required");
const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
const commands = [
  new SlashCommandBuilder()
    .setName("otp")
    .setDescription(
      "Send a one-time Exoah sign-in code to your direct messages.",
    )
    .toJSON(),
];
const route = GUILD_ID
  ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
  : Routes.applicationCommands(CLIENT_ID);
await rest.post(route, { body: commands[0] });
console.log("Registered the /otp command.");
