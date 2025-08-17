import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import express from 'express';
import { generateOtp, validateOtp, getStatus } from './otpStore.js';

const {
  DISCORD_TOKEN,
  CLIENT_ID,
  GUILD_ID,
  PORT = 3020,
  OTP_TTL_SECONDS = 300,
  MAX_INVALID_ATTEMPTS = 3,
  SHARED_SECRET
} = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !SHARED_SECRET) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Endpoint for API server to validate an OTP
app.post('/verify-otp', (req, res) => {
  const { userId, code, secret } = req.body;
  if (secret !== SHARED_SECRET) return res.status(403).json({ ok: false, error: 'forbidden' });
  const result = validateOtp(userId, code);
  return res.json(result);
});

// (Optional) endpoint to fetch status (for debugging)
app.get('/otp-status/:userId', (req, res) => {
  const { userId } = req.params;
  const status = getStatus(userId);
  if (!status) return res.status(404).json({ ok: false });
  res.json(status);
});

app.listen(PORT, () => console.log(`Discord OTP service listening on :${PORT}`));

// Discord bot setup
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMessages] });

const commands = [
  new SlashCommandBuilder()
    .setName('otp')
    .setDescription('Generate a one-time login code (sent via DM).'),
];

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log('Registered guild commands');
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('Registered global commands');
    }
  } catch (e) {
    console.error('Failed to register commands', e);
  }
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'otp') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const code = generateOtp(interaction.user.id, Number(OTP_TTL_SECONDS), Number(MAX_INVALID_ATTEMPTS));
      await interaction.user.send(`Your login code is: ${code} (valid for ${OTP_TTL_SECONDS} seconds)`);
      await interaction.editReply('A code has been sent to your DMs.');
    } catch (e) {
      await interaction.editReply('Unable to send you a DM. Please enable DMs and try again.');
    }
  }
});

registerCommands();
client.login(DISCORD_TOKEN);
