import {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
} from "discord.js";
import "dotenv/config";
import fs from "fs";
import express from "express";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

// === DB File ===
const DATA_FILE = "./whitelist-data.json";
let userData = {};
if (fs.existsSync(DATA_FILE)) {
  try {
    userData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    console.log("✅ Loaded whitelist data.");
  } catch (err) {
    console.error("❌ Failed to load user data:", err);
  }
}

// === Register Slash Command ===
const registerCommands = async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  const commands = [
    new SlashCommandBuilder()
      .setName("setup")
      .setDescription("Send the whitelist/rename GUI to this channel"),
  ];

  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
    console.log("✅ Registered slash commands.");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
};

client.once("ready", async () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  await registerCommands();
});

// === Slash Command: /setup ===
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "setup") {
    const embed = new EmbedBuilder()
      .setTitle("🧾 Whitelist Panel")
      .setDescription(
        "Click to whitelist or rename your Minecraft name on **Nine SMP** server!",
      )
      .setColor("#00FFAA");

    const whitelistButton = new ButtonBuilder()
      .setCustomId("open_whitelist_modal")
      .setLabel("🎮 Click to Whitelist")
      .setStyle(ButtonStyle.Success);

    const renameButton = new ButtonBuilder()
      .setCustomId("rename_whitelist_modal")
      .setLabel("♻ Rename Username")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(
      whitelistButton,
      renameButton,
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
    });
  }

  // ======= First-Time Whitelist =======
  if (
    interaction.isButton() &&
    interaction.customId === "open_whitelist_modal"
  ) {
    if (userData[interaction.user.id]) {
      return interaction.reply({
        content: "❌ You already submitted a name. Use Rename option.",
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("submit_whitelist")
      .setTitle("Minecraft Whitelist");

    const mcInput = new TextInputBuilder()
      .setCustomId("mc_name")
      .setLabel("Enter your Minecraft username")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("e.g. NeonPlayz");

    modal.addComponents(new ActionRowBuilder().addComponents(mcInput));
    await interaction.showModal(modal);
  }

  // ======= Rename Username =======
  if (
    interaction.isButton() &&
    interaction.customId === "rename_whitelist_modal"
  ) {
    if (!userData[interaction.user.id]) {
      return interaction.reply({
        content:
          "❌ You haven't whitelisted yet. Use the whitelist button first.",
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("rename_whitelist")
      .setTitle("Rename Minecraft Username");

    const mcInput = new TextInputBuilder()
      .setCustomId("new_mc_name")
      .setLabel("Enter your NEW Minecraft username")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("e.g. NewName");

    modal.addComponents(new ActionRowBuilder().addComponents(mcInput));
    await interaction.showModal(modal);
  }

  // ======= Submit Whitelist =======
  if (
    interaction.isModalSubmit() &&
    interaction.customId === "submit_whitelist"
  ) {
    const mcName = interaction.fields.getTextInputValue("mc_name").trim();
    await interaction.deferReply({ ephemeral: true });

    if (!/^\.?[a-zA-Z0-9_]{3,16}$/.test(mcName)) {
      return interaction.editReply({
        content: "❌ Invalid Minecraft username!",
      });
    }

    const commandChannel = await client.channels.fetch(
      process.env.COMMAND_CHANNEL_ID,
    );
    await commandChannel.send(`twl add ${mcName} permanent`);
    userData[interaction.user.id] = mcName;
    fs.writeFileSync(DATA_FILE, JSON.stringify(userData, null, 2));

    await interaction.editReply({
      content: `✅ Whitelisted as \`${mcName}\`. Use the rename button to update.`,
    });
  }

  // ======= Submit Rename =======
  if (
    interaction.isModalSubmit() &&
    interaction.customId === "rename_whitelist"
  ) {
    const newName = interaction.fields.getTextInputValue("new_mc_name").trim();
    await interaction.deferReply({ ephemeral: true });

    if (!/^\.?[a-zA-Z0-9_]{3,16}$/.test(newName)) {
      return interaction.editReply({
        content: "❌ Invalid Minecraft username!",
      });
    }

    const oldName = userData[interaction.user.id];
    const commandChannel = await client.channels.fetch(
      process.env.COMMAND_CHANNEL_ID,
    );
    await commandChannel.send(`twl remove ${oldName}`);
    await commandChannel.send(`twl add ${newName} permanent`);
    userData[interaction.user.id] = newName;
    fs.writeFileSync(DATA_FILE, JSON.stringify(userData, null, 2));

    await interaction.editReply({
      content: `♻ Updated username from \`${oldName}\` to \`${newName}\`.`,
    });
  }
});

// === Express Server (keep alive) ===
const app = express();
app.get("/", (req, res) => res.send("✅ Nine SMP Bot is alive!"));
app.listen(3000, () => console.log("🌐 Express running on port 3000"));

client.login(process.env.TOKEN);
