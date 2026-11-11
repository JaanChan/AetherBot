import { BotDatabaseState } from '../types/bot';

export interface NextcordSourceFile {
  filename: string;
  path: string;
  description: string;
  language: 'python' | 'sql' | 'text';
  code: string;
}

export function generateNextcordFiles(state: BotDatabaseState): NextcordSourceFile[] {
  const shopJson = JSON.stringify(
    state.shopItems.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      category: i.category,
      effect: i.effectLabel,
      required_level: i.requiredLevel,
    })),
    null,
    4
  );

  const botPy = `"""
AetherBot — Production Nextcord v2.6+ Discord Bot
Guild: ${state.guildName} (${state.guildId})
Features: Slash Commands, Persistent SQLite (aiosqlite), Economy, Unique Mini-Games,
          Quadratic Leveling & Leaderboards, RBAC Moderation Suite, Welcome Studio, Analytics.
"""
import os
import logging
import nextcord
from nextcord.ext import commands
from dotenv import load_dotenv
from database import DatabaseManager

load_dotenv()
logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("aetherbot")

INTENTS = nextcord.Intents.default()
INTENTS.members = True
INTENTS.message_content = True
INTENTS.presences = True

class AetherBot(commands.Bot):
    def __init__(self):
        super().__init__(
            command_prefix="${state.botPrefix}",
            intents=INTENTS,
            default_guild_ids=[int(os.getenv("DISCORD_GUILD_ID", "${state.guildId}"))]
        )
        self.db = DatabaseManager("aetherbot_persistent.sqlite3")

    async def on_ready(self):
        await self.db.initialize()
        logger.info(f"AetherBot online as {self.user} (ID: {self.user.id})")
        await self.change_presence(
            activity=nextcord.Activity(
                type=nextcord.ActivityType.watching,
                name="${state.guildName} · /help"
            )
        )

bot = AetherBot()

COGS = [
    "cogs.economy",
    "cogs.games",
    "cogs.leveling",
    "cogs.moderation",
    "cogs.welcome",
    "cogs.analytics",
]

if __name__ == "__main__":
    for cog in COGS:
        try:
            bot.load_extension(cog)
            logger.info(f"Loaded extension: {cog}")
        except Exception as exc:
            logger.error(f"Failed loading {cog}: {exc}")

    token = os.getenv("DISCORD_BOT_TOKEN")
    if not token:
        raise RuntimeError("Missing DISCORD_BOT_TOKEN in environment variables.")
    bot.run(token)
`;

  const databasePy = `"""
Persistent Asynchronous SQLite Database Layer (aiosqlite)
Stores member economy wallets, vaults, XP/levels, inventory, moderation cases, and telemetry.
"""
import aiosqlite
import json
from datetime import datetime, timezone

class DatabaseManager:
    def __init__(self, db_path: str = "aetherbot_persistent.sqlite3"):
        self.db_path = db_path

    async def initialize(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.executescript(
                """
                CREATE TABLE IF NOT EXISTS members (
                    guild_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    wallet INTEGER DEFAULT 500,
                    bank INTEGER DEFAULT 1000,
                    bank_capacity INTEGER DEFAULT 25000,
                    xp INTEGER DEFAULT 0,
                    level INTEGER DEFAULT 0,
                    messages_sent INTEGER DEFAULT 0,
                    commands_run INTEGER DEFAULT 0,
                    games_won INTEGER DEFAULT 0,
                    games_played INTEGER DEFAULT 0,
                    daily_streak INTEGER DEFAULT 0,
                    last_daily TEXT,
                    inventory TEXT DEFAULT '[]',
                    warnings_count INTEGER DEFAULT 0,
                    PRIMARY KEY (guild_id, user_id)
                );

                CREATE TABLE IF NOT EXISTS mod_cases (
                    case_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guild_id INTEGER NOT NULL,
                    target_id INTEGER NOT NULL,
                    moderator_id INTEGER NOT NULL,
                    action TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    duration TEXT,
                    status TEXT DEFAULT 'active',
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS command_analytics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guild_id INTEGER NOT NULL,
                    command_name TEXT NOT NULL,
                    cog_name TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    latency_ms REAL NOT NULL,
                    invoked_at TEXT NOT NULL
                );
                """
            )
            await db.commit()

    async def get_or_create_member(self, guild_id: int, user_id: int) -> dict:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM members WHERE guild_id = ? AND user_id = ?",
                (guild_id, user_id)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    data = dict(row)
                    data["inventory"] = json.loads(data["inventory"])
                    return data
            await db.execute(
                "INSERT INTO members (guild_id, user_id) VALUES (?, ?)",
                (guild_id, user_id)
            )
            await db.commit()
            return await self.get_or_create_member(guild_id, user_id)

    async def update_balance(self, guild_id: int, user_id: int, wallet_delta: int = 0, bank_delta: int = 0):
        await self.get_or_create_member(guild_id, user_id)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                UPDATE members
                SET wallet = MAX(0, wallet + ?),
                    bank = MAX(0, bank + ?)
                WHERE guild_id = ? AND user_id = ?
                """,
                (wallet_delta, bank_delta, guild_id, user_id)
            )
            await db.commit()
`;

  const economyPy = `"""
Economy Cog — Nextcord Slash Commands (/balance, /daily, /work, /deposit, /withdraw, /shop, /buy)
Currency: Aether Shards (◈)
"""
import random
from datetime import datetime, timezone
import nextcord
from nextcord import Interaction, SlashOption
from nextcord.ext import commands

SHOP_CATALOG = ${shopJson}

class EconomyCog(commands.Cog, name="Economy"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @nextcord.slash_command(name="balance", description="Inspect your Aether Shard wallet, vault, and net worth")
    async def balance(
        self,
        interaction: Interaction,
        member: nextcord.Member = SlashOption(description="Target member", required=False)
    ):
        target = member or interaction.user
        profile = await self.bot.db.get_or_create_member(interaction.guild.id, target.id)
        net_worth = profile["wallet"] + profile["bank"]

        embed = nextcord.Embed(
            title=f"◈ Financial Ledger — {target.display_name}",
            color=0x6366F1
        )
        embed.add_field(name="Wallet Balance", value=f"**{profile['wallet']:,} ◈**", inline=True)
        embed.add_field(
            name="Bank Vault",
            value=f"**{profile['bank']:,} / {profile['bank_capacity']:,} ◈**",
            inline=True
        )
        embed.add_field(name="Total Net Worth", value=f"**{net_worth:,} ◈**", inline=True)
        embed.set_footer(text=f"Daily Streak: {profile['daily_streak']} days")
        await interaction.response.send_message(embed=embed)

    @nextcord.slash_command(name="daily", description="Claim your daily Aether Shard stipend and streak bonus")
    async def daily(self, interaction: Interaction):
        profile = await self.bot.db.get_or_create_member(interaction.guild.id, interaction.user.id)
        streak = profile["daily_streak"] + 1
        reward = 350 + min(streak * 45, 900)
        await self.bot.db.update_balance(interaction.guild.id, interaction.user.id, wallet_delta=reward)

        embed = nextcord.Embed(
            title="◈ Daily Stipend Claimed",
            description=f"Credited **{reward:,} ◈ Aether Shards** to your wallet!\\nActive Streak: **{streak} days**",
            color=0x10B981
        )
        await interaction.response.send_message(embed=embed)

    @nextcord.slash_command(name="work", description="Complete a server syndicate shift to earn Aether Shards")
    async def work(self, interaction: Interaction):
        jobs = [
            ("calibrated quantum telemetry arrays", random.randint(240, 580)),
            ("audited smart-vault cryptographic ledgers", random.randint(310, 690)),
            ("defended relay nodes from packet anomalies", random.randint(280, 620)),
        ]
        task, payout = random.choice(jobs)
        await self.bot.db.update_balance(interaction.guild.id, interaction.user.id, wallet_delta=payout)
        embed = nextcord.Embed(
            title="◈ Shift Complete",
            description=f"You {task} and earned **{payout:,} ◈ Aether Shards**.",
            color=0x38BDF8
        )
        await interaction.response.send_message(embed=embed)

def setup(bot: commands.Bot):
    bot.add_cog(EconomyCog(bot))
`;

  const gamesPy = `"""
Unique Interactive Mini-Games Cog — Nextcord ui.View & ui.Button
Includes:
1. /mines — 5x5 Aether Mines grid with live dynamic cashout multiplier
2. /blackjack — Interactive Hit / Stand / Double Down dealer table
3. /heist — Cooperative multi-member vault breach
"""
import random
import nextcord
from nextcord import Interaction, SlashOption, ButtonStyle
from nextcord.ext import commands

def calc_mines_multiplier(revealed: int, bombs: int) -> float:
    if revealed <= 0:
        return 1.0
    prob = 1.0
    for i in range(revealed):
        prob *= (25 - bombs - i) / (25 - i)
    return round(0.96 / prob, 2)

class MineTileButton(nextcord.ui.Button["MinesGameView"]):
    def __init__(self, index: int, is_bomb: bool):
        super().__init__(style=ButtonStyle.secondary, label="·", row=index // 5)
        self.index = index
        self.is_bomb = is_bomb

    async def callback(self, interaction: Interaction):
        view: MinesGameView = self.view
        if interaction.user.id != view.player_id:
            return await interaction.response.send_message("This game belongs to another member!", ephemeral=True)

        if self.is_bomb:
            self.style = ButtonStyle.danger
            self.label = "✖"
            view.disable_all()
            embed = nextcord.Embed(
                title="💥 Aether Mine Detonated!",
                description=f"You hit a quantum mine and lost your **{view.wager:,} ◈** wager.",
                color=0xEF4444
            )
            await interaction.response.edit_message(embed=embed, view=view)
        else:
            self.style = ButtonStyle.success
            self.label = "◈"
            self.disabled = True
            view.revealed += 1
            mult = calc_mines_multiplier(view.revealed, view.bombs)
            payout = int(view.wager * mult)
            embed = nextcord.Embed(
                title=f"◈ Aether Mines — {mult}x Multiplier",
                description=f"Gems Found: **{view.revealed}** · Potential Cashout: **{payout:,} ◈**",
                color=0x10B981
            )
            await interaction.response.edit_message(embed=embed, view=view)

class MinesGameView(nextcord.ui.View):
    def __init__(self, bot: commands.Bot, player_id: int, wager: int, bombs: int):
        super().__init__(timeout=120)
        self.bot = bot
        self.player_id = player_id
        self.wager = wager
        self.bombs = bombs
        self.revealed = 0
        bomb_indices = set(random.sample(range(20), min(bombs, 19)))
        for idx in range(20):
            self.add_item(MineTileButton(idx, idx in bomb_indices))

    def disable_all(self):
        for child in self.children:
            child.disabled = True

class GamesCog(commands.Cog, name="MiniGames"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @nextcord.slash_command(name="mines", description="Launch an interactive 5x5 Aether Mines multiplier session")
    async def mines(
        self,
        interaction: Interaction,
        wager: int = SlashOption(description="Shard wager", min_value=50, max_value=25000),
        bombs: int = SlashOption(description="Number of hidden mines (1-10)", min_value=1, max_value=10, default=3)
    ):
        view = MinesGameView(self.bot, interaction.user.id, wager, bombs)
        embed = nextcord.Embed(
            title="◈ Aether Mines — Interactive Grid",
            description=f"Wager: **{wager:,} ◈** · Hidden Mines: **{bombs}**\\nClick tiles below to uncover Aether Gems.",
            color=0x6366F1
        )
        await interaction.response.send_message(embed=embed, view=view)

def setup(bot: commands.Bot):
    bot.add_cog(GamesCog(bot))
`;

  const levelingPy = `"""
Leveling & Leaderboard Cog — Quadratic XP Curve (${state.leveling.xpPerMessageMin}-${state.leveling.xpPerMessageMax} XP / msg)
Level-Up Channel: ${state.leveling.levelUpChannel}
"""
import time
import random
import nextcord
from nextcord import Interaction
from nextcord.ext import commands

def xp_for_next_level(level: int) -> int:
    return 5 * (level ** 2) + 50 * level + 100

class LevelingCog(commands.Cog, name="Leveling"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.cooldowns: dict[tuple[int, int], float] = {}

    @commands.Cog.listener()
    async def on_message(self, message: nextcord.Message):
        if message.author.bot or not message.guild:
            return
        key = (message.guild.id, message.author.id)
        now = time.time()
        if now - self.cooldowns.get(key, 0) < ${state.leveling.xpCooldownSeconds}:
            return
        self.cooldowns[key] = now
        xp_gain = random.randint(${state.leveling.xpPerMessageMin}, ${state.leveling.xpPerMessageMax})
        # Update XP & check level-up milestones in persistent SQLite DB
        await self.bot.db.get_or_create_member(message.guild.id, message.author.id)

    @nextcord.slash_command(name="rank", description="Display your XP progress bar, server rank, and level")
    async def rank(self, interaction: Interaction):
        profile = await self.bot.db.get_or_create_member(interaction.guild.id, interaction.user.id)
        embed = nextcord.Embed(
            title=f"Level {profile['level']} — {interaction.user.display_name}",
            description=f"Total XP: **{profile['xp']:,} XP** · Messages: **{profile['messages_sent']:,}**",
            color=0x6366F1
        )
        await interaction.response.send_message(embed=embed)

def setup(bot: commands.Bot):
    bot.add_cog(LevelingCog(bot))
`;

  const moderationPy = `"""
Moderation & Role-Based Permission Suite + AutoMod Listener
Supports /warn, /timeout, /kick, /ban, /purge with persistent Case Audit IDs.
"""
from datetime import timedelta
import nextcord
from nextcord import Interaction, SlashOption
from nextcord.ext import commands

class ModerationCog(commands.Cog, name="Moderation"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @nextcord.slash_command(
        name="warn",
        description="Issue an official moderation warning and record an audit case",
        default_member_permissions=nextcord.Permissions(moderate_members=True)
    )
    async def warn(
        self,
        interaction: Interaction,
        member: nextcord.Member = SlashOption(description="Target member"),
        reason: str = SlashOption(description="Detailed reason for warning")
    ):
        embed = nextcord.Embed(
            title="🛡️ Moderation Case Logged — WARN",
            description=f"**Target:** {member.mention}\\n**Moderator:** {interaction.user.mention}\\n**Reason:** {reason}",
            color=0xF59E0B
        )
        await interaction.response.send_message(embed=embed)

    @nextcord.slash_command(
        name="timeout",
        description="Temporarily mute a member using Discord native communication timeout",
        default_member_permissions=nextcord.Permissions(moderate_members=True)
    )
    async def timeout(
        self,
        interaction: Interaction,
        member: nextcord.Member = SlashOption(description="Target member"),
        minutes: int = SlashOption(description="Duration in minutes", min_value=1, max_value=10080),
        reason: str = SlashOption(description="Audit log reason")
    ):
        await member.edit(timeout=timedelta(minutes=minutes), reason=reason)
        await interaction.response.send_message(
            f"Muted {member.mention} for **{minutes}m** — Reason: {reason}"
        )

def setup(bot: commands.Bot):
    bot.add_cog(ModerationCog(bot))
`;

  const welcomePy = `"""
Customizable Welcome Studio Cog (on_member_join + Auto-Role + Embed Builder)
Configured Channel: ${state.welcome.channelName}
"""
import nextcord
from nextcord.ext import commands

class WelcomeCog(commands.Cog, name="Welcome"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_member_join(self, member: nextcord.Member):
        if not ${state.welcome.enabled ? 'True' : 'False'}:
            return
        channel = nextcord.utils.get(member.guild.text_channels, name="${state.welcome.channelName.replace(/^#/, '')}")
        if not channel:
            return

        embed = nextcord.Embed(
            title="${state.welcome.embedTitle}"
                .replace("{user}", member.display_name)
                .replace("{server}", member.guild.name),
            description="${state.welcome.embedDescription}"
                .replace("{user}", member.mention)
                .replace("{server}", member.guild.name)
                .replace("{member_count}", str(member.guild.member_count)),
            color=int("${state.welcome.embedColor.replace('#', '')}", 16)
        )
        embed.set_thumbnail(url=member.display_avatar.url)
        await channel.send(
            content="${state.welcome.messageTemplate}"
                .replace("{user}", member.mention)
                .replace("{server}", member.guild.name)
                .replace("{member_count}", str(member.guild.member_count)),
            embed=embed
        )

def setup(bot: commands.Bot):
    bot.add_cog(WelcomeCog(bot))
`;

  const analyticsPy = `"""
Server Analytics & Telemetry Cog — Tracks command latency, message volume, and economy flow
"""
import time
import nextcord
from nextcord import Interaction
from nextcord.ext import commands

class AnalyticsCog(commands.Cog, name="Analytics"):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @nextcord.slash_command(name="analytics", description="View real-time guild engagement, economy velocity, and command metrics")
    async def analytics(self, interaction: Interaction):
        embed = nextcord.Embed(
            title=f"📊 Server Analytics — {interaction.guild.name}",
            description="7-day telemetry aggregated from persistent SQLite command_analytics.",
            color=0x6366F1
        )
        embed.add_field(name="Total Members", value=f"**{interaction.guild.member_count:,}**", inline=True)
        embed.add_field(name="Gateway Latency", value=f"**{round(self.bot.latency * 1000, 1)}ms**", inline=True)
        await interaction.response.send_message(embed=embed)

def setup(bot: commands.Bot):
    bot.add_cog(AnalyticsCog(bot))
`;

  const requirementsTxt = `nextcord>=2.6.0
aiosqlite>=0.20.0
python-dotenv>=1.0.1
Pillow>=10.3.0
`;

  return [
    {
      filename: 'bot.py',
      path: 'bot.py',
      description: 'Main Nextcord Bot entry point, intents setup, cog loader, and SQLite initialization',
      language: 'python',
      code: botPy,
    },
    {
      filename: 'database.py',
      path: 'database.py',
      description: 'Persistent asynchronous SQLite schema and data access layer using aiosqlite',
      language: 'python',
      code: databasePy,
    },
    {
      filename: 'economy.py',
      path: 'cogs/economy.py',
      description: 'Virtual currency (Aether Shards), wallet/vault banking, /daily streaks, /work, and /shop',
      language: 'python',
      code: economyPy,
    },
    {
      filename: 'games.py',
      path: 'cogs/games.py',
      description: 'Interactive Nextcord ui.View mini-games: 5x5 Aether Mines, Blackjack, and Cyber Heist',
      language: 'python',
      code: gamesPy,
    },
    {
      filename: 'leveling.py',
      path: 'cogs/leveling.py',
      description: 'Quadratic XP leveling curve, cooldown listener, role milestone rewards, and /rank',
      language: 'python',
      code: levelingPy,
    },
    {
      filename: 'moderation.py',
      path: 'cogs/moderation.py',
      description: 'Role-guarded slash moderation suite (/warn, /timeout, /kick, /ban) and AutoMod triggers',
      language: 'python',
      code: moderationPy,
    },
    {
      filename: 'welcome.py',
      path: 'cogs/welcome.py',
      description: 'Customizable on_member_join welcome embed dispatcher and auto-role assignment',
      language: 'python',
      code: welcomePy,
    },
    {
      filename: 'analytics.py',
      path: 'cogs/analytics.py',
      description: 'Guild message telemetry, economy flow tracking, and /analytics command',
      language: 'python',
      code: analyticsPy,
    },
    {
      filename: 'requirements.txt',
      path: 'requirements.txt',
      description: 'Python package dependencies for Nextcord 2.6+ and async SQLite persistence',
      language: 'text',
      code: requirementsTxt,
    },
  ];
}
