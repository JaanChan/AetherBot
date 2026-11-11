import React, { useState } from 'react';
import {
  BotDatabaseState,
  MemberProfile,
  PermissionKey,
  SandboxMessage,
  TransactionRecord,
} from '../types/bot';
import {
  calculateLevelProgress,
  calculateMinesMultiplier,
  evaluateBlackjackHand,
  hasRolePermission,
  cleanDiscordText,
} from '../utils/botEngine';
import {
  Terminal,
  Coins,
  Sparkles,
  ShieldAlert,
  Play,
  RotateCcw,
  Send,
  Trophy,
  Crosshair,
  HelpCircle,
} from 'lucide-react';

interface CommandSandboxViewProps {
  state: BotDatabaseState;
  onUpdateState: (updater: (prev: BotDatabaseState) => BotDatabaseState) => void;
}

interface Card {
  rank: string;
  suit: string;
  value: number;
}

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS: { rank: string; value: number }[] = [
  { rank: 'A', value: 11 },
  { rank: '2', value: 2 },
  { rank: '3', value: 3 },
  { rank: '4', value: 4 },
  { rank: '5', value: 5 },
  { rank: '6', value: 6 },
  { rank: '7', value: 7 },
  { rank: '8', value: 8 },
  { rank: '9', value: 9 },
  { rank: '10', value: 10 },
  { rank: 'J', value: 10 },
  { rank: 'Q', value: 10 },
  { rank: 'K', value: 10 },
];

function drawRandomCard(): Card {
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  const r = RANKS[Math.floor(Math.random() * RANKS.length)];
  return { rank: r.rank, suit, value: r.value };
}

const TRIVIA_BANK = [
  {
    q: 'Which decorator registers a slash application command inside a Nextcord Cog?',
    options: [
      '@nextcord.slash_command()',
      '@commands.register_slash()',
      '@bot.tree.command()',
      '@nextcord.app_command()',
    ],
    correct: 0,
    reward: 450,
    xp: 120,
  },
  {
    q: 'What base class is used in Nextcord to build persistent interactive button rows?',
    options: [
      'nextcord.ui.View',
      'nextcord.ActionRowBuilder',
      'nextcord.ext.ButtonGroup',
      'nextcord.ComponentGrid',
    ],
    correct: 0,
    reward: 500,
    xp: 140,
  },
  {
    q: 'Which Discord Gateway Intent is required to trigger on_member_join welcome events?',
    options: [
      'intents.members = True',
      'intents.presences = True',
      'intents.message_content = True',
      'intents.webhooks = True',
    ],
    correct: 0,
    reward: 400,
    xp: 110,
  },
  {
    q: 'In asynchronous Nextcord bots, which driver provides non-blocking SQLite persistence?',
    options: ['aiosqlite', 'sqlite3-sync', 'pymysql-lite', 'nextcord-sql'],
    correct: 0,
    reward: 520,
    xp: 150,
  },
];

export const CommandSandboxView: React.FC<CommandSandboxViewProps> = ({
  state,
  onUpdateState,
}) => {
  const activeMember =
    state.members.find((m) => m.id === state.activeMemberId) || state.members[0];
  const activeRole =
    state.roles.find((r) => r.id === activeMember.roleId) || state.roles[0];
  const levelInfo = calculateLevelProgress(activeMember.xp);

  const [commandInput, setCommandInput] = useState('/daily');
  const [activeGameTab, setActiveGameTab] = useState<
    'mines' | 'blackjack' | 'heist' | 'trivia'
  >('mines');

  // --- Mini-Game 1: Aether Mines (5x5) State ---
  const [minesWager, setMinesWager] = useState<number>(500);
  const [minesBombCount, setMinesBombCount] = useState<number>(4);
  const [minesActive, setMinesActive] = useState<boolean>(false);
  const [minesBombs, setMinesBombs] = useState<number[]>([]);
  const [minesRevealed, setMinesRevealed] = useState<number[]>([]);
  const [minesStatus, setMinesStatus] = useState<
    'idle' | 'playing' | 'won' | 'lost'
  >('idle');
  const [minesMessage, setMinesMessage] = useState<string>(
    'Select your Shard wager and bomb density, then launch the 5x5 grid.'
  );

  // --- Mini-Game 2: Blackjack State ---
  const [bjWager, setBjWager] = useState<number>(500);
  const [bjPlayerCards, setBjPlayerCards] = useState<Card[]>([]);
  const [bjDealerCards, setBjDealerCards] = useState<Card[]>([]);
  const [bjStatus, setBjStatus] = useState<
    'idle' | 'playing' | 'won' | 'lost' | 'push'
  >('idle');
  const [bjMessage, setBjMessage] = useState<string>(
    'Deal a hand against the Syndicate Dealer. Blackjack pays 2.5x.'
  );

  // --- Mini-Game 3: Cyber Heist State ---
  const [heistWager, setHeistWager] = useState<number>(1000);
  const [heistStrategy, setHeistStrategy] = useState<'stealth' | 'overclock'>(
    'stealth'
  );
  const [heistResult, setHeistResult] = useState<{
    outcome: 'idle' | 'success' | 'busted';
    log: string[];
    delta: number;
  }>({
    outcome: 'idle',
    log: [
      'Crew ready. Stealth Cloak owners gain +15% breach probability and 50% reduced fine.',
    ],
    delta: 0,
  });

  // --- Mini-Game 4: Trivia State ---
  const [triviaIndex, setTriviaIndex] = useState<number>(0);
  const [triviaFeedback, setTriviaFeedback] = useState<string | null>(null);

  const appendSandboxInteraction = (
    cmdName: string,
    embedTitle: string,
    embedDesc: string,
    color: string,
    fields: { name: string; value: string; inline?: boolean }[] = [],
    memberUpdater?: (m: MemberProfile) => MemberProfile,
    txRecord?: Omit<TransactionRecord, 'id' | 'timestamp'>
  ) => {
    onUpdateState((prev) => {
      const targetMember =
        prev.members.find((m) => m.id === prev.activeMemberId) ||
        prev.members[0];
      const role =
        prev.roles.find((r) => r.id === targetMember.roleId) || prev.roles[0];

      const updatedMembers = prev.members.map((m) => {
        if (m.id !== targetMember.id) return m;
        const afterCustom = memberUpdater ? memberUpdater(m) : m;
        const recalculated = calculateLevelProgress(afterCustom.xp);
        return {
          ...afterCustom,
          level: recalculated.level,
          commandsRun: afterCustom.commandsRun + 1,
        };
      });

      const newMsg: SandboxMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        authorId: targetMember.id,
        authorName: targetMember.displayName,
        authorRoleName: role.name,
        authorRoleColor: role.color,
        isBot: true,
        commandUsed: cmdName,
        embed: {
          title: embedTitle,
          description: embedDesc,
          color,
          fields,
          footer: `Executed by @${targetMember.username} · Role: ${role.name}`,
        },
        timestamp: new Date().toISOString(),
      };

      const newTransactions = txRecord
        ? [
            {
              ...txRecord,
              id: `tx-${Date.now()}`,
              timestamp: new Date().toISOString(),
            },
            ...prev.transactions,
          ].slice(0, 50)
        : prev.transactions;

      return {
        ...prev,
        members: updatedMembers,
        transactions: newTransactions,
        sandboxMessages: [...prev.sandboxMessages.slice(-24), newMsg],
      };
    });
  };

  const executeSlashCommand = (rawCmd: string) => {
    const trimmed = rawCmd.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/\s+/);
    const baseCmd = (parts[0].startsWith('/') ? parts[0] : `/${parts[0]}`).toLowerCase();
    const arg1 = parts[1];
    const arg2 = parts.slice(2).join(' ');

    const checkPerm = (perm: PermissionKey, label: string): boolean => {
      if (!hasRolePermission(activeMember, state.roles, perm)) {
        appendSandboxInteraction(
          trimmed,
          'Missing Role Permission (Nextcord CheckFailure)',
          `Your assigned role (**${activeRole.name}**) does not grant the \`${label}\` permission required to run \`${baseCmd}\`. Switch roles in the RBAC bar or ask an Admin to grant access.`,
          '#EF4444',
          [
            { name: 'Required Permission', value: label, inline: true },
            { name: 'Current Role', value: activeRole.name, inline: true },
          ]
        );
        return false;
      }
      return true;
    };

    if (baseCmd === '/balance' || baseCmd === '/bal') {
      if (!checkPerm('run_economy', 'run_economy')) return;
      const netWorth = activeMember.wallet + activeMember.bank;
      appendSandboxInteraction(
        trimmed,
        `◈ Financial Ledger — ${activeMember.displayName}`,
        `Persistent account summary synchronized from SQLite storage.`,
        '#6366F1',
        [
          { name: 'Wallet', value: `${activeMember.wallet.toLocaleString()} ◈`, inline: true },
          {
            name: 'Bank Vault',
            value: `${activeMember.bank.toLocaleString()} / ${activeMember.bankCapacity.toLocaleString()} ◈`,
            inline: true,
          },
          { name: 'Net Worth', value: `${netWorth.toLocaleString()} ◈`, inline: true },
        ]
      );
    } else if (baseCmd === '/daily') {
      if (!checkPerm('run_economy', 'run_economy')) return;
      const baseReward = 400;
      const streakBonus = (activeMember.dailyStreak + 1) * 35;
      const roleBonus = activeRole.dailyBonus;
      const totalReward = baseReward + streakBonus + roleBonus;
      const xpGain = Math.round(80 * activeRole.xpMultiplier);

      appendSandboxInteraction(
        trimmed,
        '◈ Daily Stipend & Streak Claimed',
        `Credited **+${totalReward.toLocaleString()} ◈ Aether Shards** and **+${xpGain} XP** to your profile!`,
        '#10B981',
        [
          { name: 'Base + Streak', value: `${(baseReward + streakBonus).toLocaleString()} ◈`, inline: true },
          { name: `${activeRole.name} Bonus`, value: `+${roleBonus.toLocaleString()} ◈`, inline: true },
          { name: 'New Streak', value: `${activeMember.dailyStreak + 1} Days`, inline: true },
        ],
        (m) => ({
          ...m,
          wallet: m.wallet + totalReward,
          xp: m.xp + xpGain,
          dailyStreak: m.dailyStreak + 1,
          lastDailyClaim: new Date().toISOString(),
        }),
        {
          memberId: activeMember.id,
          memberName: activeMember.displayName,
          type: 'daily',
          amount: totalReward,
          description: `Claimed /daily stipend (${activeMember.dailyStreak + 1}-day streak)`,
        }
      );
    } else if (baseCmd === '/work') {
      if (!checkPerm('run_economy', 'run_economy')) return;
      const shifts = [
        { title: 'Quantum Relay Calibration', base: 480 },
        { title: 'Smart-Contract Audit Shift', base: 560 },
        { title: 'Deep-Core Telemetry Extraction', base: 510 },
        { title: 'Firewall Anomaly Mitigation', base: 620 },
      ];
      const chosen = shifts[Math.floor(Math.random() * shifts.length)];
      const earned = Math.round(chosen.base * activeRole.xpMultiplier);
      const xpEarned = Math.round(65 * activeRole.xpMultiplier);

      appendSandboxInteraction(
        trimmed,
        `◈ Syndicate Work Shift — ${chosen.title}`,
        `Completed shift with **${activeRole.xpMultiplier}x** role multiplier. Earned **+${earned.toLocaleString()} ◈** and **+${xpEarned} XP**.`,
        '#0EA5E9',
        [
          { name: 'Shift Payout', value: `+${earned.toLocaleString()} ◈`, inline: true },
          { name: 'XP Earned', value: `+${xpEarned} XP`, inline: true },
          { name: 'Updated Wallet', value: `${(activeMember.wallet + earned).toLocaleString()} ◈`, inline: true },
        ],
        (m) => ({
          ...m,
          wallet: m.wallet + earned,
          xp: m.xp + xpEarned,
        }),
        {
          memberId: activeMember.id,
          memberName: activeMember.displayName,
          type: 'work',
          amount: earned,
          description: `Completed ${chosen.title} via /work`,
        }
      );
    } else if (baseCmd === '/rank' || baseCmd === '/level') {
      const sorted = [...state.members].sort((a, b) => b.xp - a.xp);
      const rankPos = sorted.findIndex((m) => m.id === activeMember.id) + 1;
      appendSandboxInteraction(
        trimmed,
        `Level ${levelInfo.level} Rank Card — ${activeMember.displayName}`,
        `Server Standing: **#${rankPos} of ${state.members.length}** · XP Multiplier: **${activeRole.xpMultiplier}x**`,
        '#6366F1',
        [
          {
            name: 'Level Progress',
            value: `${levelInfo.currentLevelXp.toLocaleString()} / ${levelInfo.nextLevelXp.toLocaleString()} XP (${levelInfo.progressPercent}%)`,
            inline: true,
          },
          { name: 'Total Cumulative XP', value: `${activeMember.xp.toLocaleString()} XP`, inline: true },
          { name: 'Mini-Games Won', value: `${activeMember.gamesWon} / ${activeMember.gamesPlayed}`, inline: true },
        ]
      );
    } else if (baseCmd === '/leaderboard' || baseCmd === '/top') {
      const top3 = [...state.members]
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 3)
        .map(
          (m, idx) =>
            `${idx + 1}. **${m.displayName}** — Lv.${calculateLevelProgress(m.xp).level} (${m.xp.toLocaleString()} XP · ${(m.wallet + m.bank).toLocaleString()} ◈)`
        )
        .join('\n');
      appendSandboxInteraction(
        trimmed,
        `🏆 ${state.guildName} — Top Leaderboard Standings`,
        top3,
        '#F59E0B'
      );
    } else if (baseCmd === '/warn' || baseCmd === '/timeout' || baseCmd === '/ban') {
      const permMap: Record<string, PermissionKey> = {
        '/warn': 'mod_warn',
        '/timeout': 'mod_timeout',
        '/ban': 'mod_ban',
      };
      const reqPerm = permMap[baseCmd] || 'mod_warn';
      if (!checkPerm(reqPerm, reqPerm)) return;

      const targetName = arg1 ? arg1.replace(/^@/, '') : 'dax_hollow';
      const reason = arg2 || 'Violation of server channel protocol via slash moderation.';
      const actionType = baseCmd.slice(1) as 'warn' | 'timeout' | 'ban';

      onUpdateState((prev) => {
        const nextCaseNum =
          prev.modCases.reduce((max, c) => Math.max(max, c.caseNumber), 100) + 1;
        const newCase = {
          id: `case-${Date.now()}`,
          caseNumber: nextCaseNum,
          targetId: 'mem-5',
          targetName,
          moderatorId: activeMember.id,
          moderatorName: activeMember.displayName,
          action: actionType,
          reason,
          duration: actionType === 'timeout' ? '30m' : undefined,
          status: 'active' as const,
          timestamp: new Date().toISOString(),
        };
        const newMsg: SandboxMessage = {
          id: `msg-${Date.now()}`,
          authorId: activeMember.id,
          authorName: activeMember.displayName,
          authorRoleName: activeRole.name,
          authorRoleColor: activeRole.color,
          isBot: true,
          commandUsed: trimmed,
          embed: {
            title: `🛡️ Audit Case #${nextCaseNum} Logged — ${actionType.toUpperCase()}`,
            description: `Dispatched Nextcord moderation action against **@${targetName}**.`,
            color: '#F59E0B',
            fields: [
              { name: 'Target', value: `@${targetName}`, inline: true },
              { name: 'Moderator', value: activeMember.displayName, inline: true },
              { name: 'Reason', value: reason, inline: false },
            ],
            footer: 'Saved to persistent mod_cases table',
          },
          timestamp: new Date().toISOString(),
        };
        return {
          ...prev,
          modCases: [newCase, ...prev.modCases],
          sandboxMessages: [...prev.sandboxMessages.slice(-24), newMsg],
        };
      });
    } else {
      appendSandboxInteraction(
        trimmed,
        'Nextcord Slash Command Router',
        `Executed \`${baseCmd}\` in \`#bot-commands\`. Available slash commands: \`/daily\`, \`/work\`, \`/balance\`, \`/rank\`, \`/leaderboard\`, \`/warn @user reason\`, \`/timeout @user reason\`, \`/ban @user reason\`.`,
        '#6366F1'
      );
    }
  };

  // --- Mini-Game 1 Handlers: Aether Mines ---
  const startMinesGame = () => {
    if (!hasRolePermission(activeMember, state.roles, 'run_games')) {
      setMinesMessage(`Role "${activeRole.name}" does not have permission to run mini-games.`);
      return;
    }
    if (activeMember.wallet < minesWager) {
      setMinesMessage(`Insufficient wallet Shards (${activeMember.wallet.toLocaleString()} ◈ available).`);
      return;
    }

    const indices = Array.from({ length: 25 }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const chosenBombs = indices.slice(0, minesBombCount);

    onUpdateState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === activeMember.id
          ? { ...m, wallet: m.wallet - minesWager, gamesPlayed: m.gamesPlayed + 1 }
          : m
      ),
    }));

    setMinesBombs(chosenBombs);
    setMinesRevealed([]);
    setMinesActive(true);
    setMinesStatus('playing');
    setMinesMessage(
      `Grid armed with ${minesBombCount} hidden mines. Click any cell to uncover Aether Gems!`
    );
  };

  const clickMineTile = (cellIdx: number) => {
    if (!minesActive || minesStatus !== 'playing' || minesRevealed.includes(cellIdx)) {
      return;
    }

    if (minesBombs.includes(cellIdx)) {
      // Hit a bomb!
      setMinesActive(false);
      setMinesStatus('lost');
      setMinesRevealed([...minesRevealed, cellIdx]);
      setMinesMessage(`Detonated a quantum mine at tile #${cellIdx + 1}! Lost ${minesWager.toLocaleString()} ◈.`);
      appendSandboxInteraction(
        `/mines wager:${minesWager} bombs:${minesBombCount}`,
        '💥 Aether Mines — Quantum Detonation',
        `Hit a mine on tile #${cellIdx + 1} after uncovering ${minesRevealed.length} gems.`,
        '#EF4444',
        [
          { name: 'Wager Lost', value: `-${minesWager.toLocaleString()} ◈`, inline: true },
          { name: 'Bombs Active', value: `${minesBombCount} Mines`, inline: true },
        ],
        undefined,
        {
          memberId: activeMember.id,
          memberName: activeMember.displayName,
          type: 'game_loss',
          amount: -minesWager,
          description: `Lost /mines session (${minesBombCount} bombs)`,
        }
      );
    } else {
      const nextRevealed = [...minesRevealed, cellIdx];
      setMinesRevealed(nextRevealed);
      const mult = calculateMinesMultiplier(nextRevealed.length, minesBombCount);
      const potential = Math.round(minesWager * mult);
      setMinesMessage(
        `Uncovered ${nextRevealed.length} Gem${nextRevealed.length > 1 ? 's' : ''}! Current Multiplier: ${mult}x (${potential.toLocaleString()} ◈)`
      );
    }
  };

  const cashOutMines = () => {
    if (!minesActive || minesRevealed.length === 0) return;
    const mult = calculateMinesMultiplier(minesRevealed.length, minesBombCount);
    const payout = Math.round(minesWager * mult);
    const netProfit = payout - minesWager;
    const xpGain = Math.round(95 * activeRole.xpMultiplier);

    setMinesActive(false);
    setMinesStatus('won');
    setMinesMessage(
      `Cashed out ${payout.toLocaleString()} ◈ (${mult}x multiplier, +${netProfit.toLocaleString()} ◈ net profit) + ${xpGain} XP!`
    );

    appendSandboxInteraction(
      `/mines cashout:${mult}x`,
      `◈ Aether Mines Cashout — ${mult}x Multiplier!`,
      `Successfully extracted **${minesRevealed.length} Aether Gems** without triggering any of the ${minesBombCount} mines.`,
      '#10B981',
      [
        { name: 'Total Payout', value: `${payout.toLocaleString()} ◈`, inline: true },
        { name: 'Net Profit', value: `+${netProfit.toLocaleString()} ◈`, inline: true },
        { name: 'XP Awarded', value: `+${xpGain} XP`, inline: true },
      ],
      (m) => ({
        ...m,
        wallet: m.wallet + payout,
        xp: m.xp + xpGain,
        gamesWon: m.gamesWon + 1,
      }),
      {
        memberId: activeMember.id,
        memberName: activeMember.displayName,
        type: 'game_win',
        amount: netProfit,
        description: `Cashed out ${mult}x in /mines (${minesRevealed.length} gems)`,
      }
    );
  };

  // --- Mini-Game 2 Handlers: Blackjack ---
  const startBlackjack = () => {
    if (!hasRolePermission(activeMember, state.roles, 'run_games')) {
      setBjMessage(`Role "${activeRole.name}" does not have permission to run mini-games.`);
      return;
    }
    if (activeMember.wallet < bjWager) {
      setBjMessage(`Insufficient wallet Shards (${activeMember.wallet.toLocaleString()} ◈).`);
      return;
    }

    const pCards = [drawRandomCard(), drawRandomCard()];
    const dCards = [drawRandomCard(), drawRandomCard()];

    onUpdateState((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === activeMember.id
          ? { ...m, wallet: m.wallet - bjWager, gamesPlayed: m.gamesPlayed + 1 }
          : m
      ),
    }));

    setBjPlayerCards(pCards);
    setBjDealerCards(dCards);
    const evalP = evaluateBlackjackHand(pCards);

    if (evalP.isBlackjack) {
      const winAmount = Math.round(bjWager * 2.5);
      setBjStatus('won');
      setBjMessage(`Natural 21 Blackjack! Won ${winAmount.toLocaleString()} ◈ (2.5x)!`);
      appendSandboxInteraction(
        `/blackjack wager:${bjWager}`,
        '🃏 Natural Blackjack 21!',
        `Dealt **${pCards.map((c) => c.rank + c.suit).join(' ')}** for an instant 2.5x payout!`,
        '#10B981',
        [{ name: 'Payout', value: `${winAmount.toLocaleString()} ◈`, inline: true }],
        (m) => ({
          ...m,
          wallet: m.wallet + winAmount,
          xp: m.xp + 120,
          gamesWon: m.gamesWon + 1,
        }),
        {
          memberId: activeMember.id,
          memberName: activeMember.displayName,
          type: 'game_win',
          amount: winAmount - bjWager,
          description: 'Natural 21 Blackjack payout',
        }
      );
    } else {
      setBjStatus('playing');
      setBjMessage(`Hand total: ${evalP.total}. Choose Hit or Stand.`);
    }
  };

  const hitBlackjack = () => {
    if (bjStatus !== 'playing') return;
    const nextCards = [...bjPlayerCards, drawRandomCard()];
    setBjPlayerCards(nextCards);
    const evalP = evaluateBlackjackHand(nextCards);
    if (evalP.isBust) {
      setBjStatus('lost');
      setBjMessage(`Busted with ${evalP.total}! Dealer wins ${bjWager.toLocaleString()} ◈.`);
      appendSandboxInteraction(
        `/blackjack action:hit`,
        '🃏 Blackjack Bust',
        `Player busted at **${evalP.total}** (${nextCards.map((c) => c.rank + c.suit).join(' ')}).`,
        '#EF4444',
        [{ name: 'Wager Lost', value: `-${bjWager.toLocaleString()} ◈`, inline: true }],
        undefined,
        {
          memberId: activeMember.id,
          memberName: activeMember.displayName,
          type: 'game_loss',
          amount: -bjWager,
          description: `Busted at ${evalP.total} in /blackjack`,
        }
      );
    } else {
      setBjMessage(`Hand total: ${evalP.total}. Hit again or Stand?`);
    }
  };

  const standBlackjack = () => {
    if (bjStatus !== 'playing') return;
    const dCards = [...bjDealerCards];
    while (evaluateBlackjackHand(dCards).total < 17) {
      dCards.push(drawRandomCard());
    }
    setBjDealerCards(dCards);
    const pTotal = evaluateBlackjackHand(bjPlayerCards).total;
    const dEval = evaluateBlackjackHand(dCards);

    if (dEval.isBust || pTotal > dEval.total) {
      const payout = bjWager * 2;
      setBjStatus('won');
      setBjMessage(
        `You win! Player ${pTotal} vs Dealer ${dEval.total}${dEval.isBust ? ' (Bust)' : ''}. Credited ${payout.toLocaleString()} ◈!`
      );
      appendSandboxInteraction(
        `/blackjack action:stand`,
        '🃏 Blackjack Victory',
        `Beat the Syndicate Dealer (**${pTotal}** vs **${dEval.total}**).`,
        '#10B981',
        [{ name: 'Payout', value: `${payout.toLocaleString()} ◈`, inline: true }],
        (m) => ({
          ...m,
          wallet: m.wallet + payout,
          xp: m.xp + 90,
          gamesWon: m.gamesWon + 1,
        }),
        {
          memberId: activeMember.id,
          memberName: activeMember.displayName,
          type: 'game_win',
          amount: bjWager,
          description: `Won /blackjack (${pTotal} vs ${dEval.total})`,
        }
      );
    } else if (pTotal === dEval.total) {
      setBjStatus('push');
      setBjMessage(`Push tie at ${pTotal}! Wager of ${bjWager.toLocaleString()} ◈ returned.`);
      onUpdateState((prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.id === activeMember.id ? { ...m, wallet: m.wallet + bjWager } : m
        ),
      }));
    } else {
      setBjStatus('lost');
      setBjMessage(`Dealer wins (${dEval.total} vs your ${pTotal}). Lost ${bjWager.toLocaleString()} ◈.`);
    }
  };

  // --- Mini-Game 3 Handler: Cooperative Cyber Heist ---
  const launchCyberHeist = () => {
    if (!hasRolePermission(activeMember, state.roles, 'run_games')) return;
    if (activeMember.wallet < heistWager) {
      setHeistResult({
        outcome: 'busted',
        log: [`Insufficient wallet Shards (${activeMember.wallet.toLocaleString()} ◈).`],
        delta: 0,
      });
      return;
    }

    const ownsCloak = activeMember.inventory.includes('Heist Stealth Cloak');
    const baseOdds = heistStrategy === 'stealth' ? 0.62 : 0.48;
    const finalOdds = Math.min(0.88, baseOdds + (ownsCloak ? 0.15 : 0));
    const mult = heistStrategy === 'stealth' ? 1.85 : 2.6;
    const roll = Math.random();

    if (roll <= finalOdds) {
      const netGain = Math.round(heistWager * (mult - 1));
      const xpGain = 150;
      const logs = [
        `[PHASE 1] Cryptographer bypassed outer TLS perimeter (${Math.round(finalOdds * 100)}% success odds)...`,
        ownsCloak
          ? `[CLOAK ACTIVE] Heist Stealth Cloak masked thermal signatures (+15% odds)!`
          : `[PHASE 2] Crew neutralized laser grid sensors...`,
        `[SUCCESS] Extracted +${netGain.toLocaleString()} ◈ net profit and +${xpGain} XP!`,
      ];
      setHeistResult({ outcome: 'success', log: logs, delta: netGain });
      appendSandboxInteraction(
        `/heist strategy:${heistStrategy} stake:${heistWager}`,
        '🔓 Syndicate Vault Heist — Breach Successful!',
        logs.join('\n'),
        '#10B981',
        [
          { name: 'Net Loot', value: `+${netGain.toLocaleString()} ◈`, inline: true },
          { name: 'XP Earned', value: `+${xpGain} XP`, inline: true },
        ],
        (m) => ({
          ...m,
          wallet: m.wallet + netGain,
          xp: m.xp + xpGain,
          gamesPlayed: m.gamesPlayed + 1,
          gamesWon: m.gamesWon + 1,
        }),
        {
          memberId: activeMember.id,
          memberName: activeMember.displayName,
          type: 'heist',
          amount: netGain,
          description: `Successful ${heistStrategy} /heist breach`,
        }
      );
    } else {
      const penalty = ownsCloak ? Math.round(heistWager * 0.5) : heistWager;
      const logs = [
        `[PHASE 1] Approached vault core using ${heistStrategy} protocol...`,
        `[ALERT] Sentinel biometric tripwire triggered during extraction!`,
        ownsCloak
          ? `[CLOAK SAVED 50%] Escaped with partial fine: -${penalty.toLocaleString()} ◈.`
          : `[BUSTED] Security confiscated your -${penalty.toLocaleString()} ◈ stake.`,
      ];
      setHeistResult({ outcome: 'busted', log: logs, delta: -penalty });
      appendSandboxInteraction(
        `/heist strategy:${heistStrategy} stake:${heistWager}`,
        '🚨 Syndicate Vault Heist — Tripwire Triggered',
        logs.join('\n'),
        '#EF4444',
        [{ name: 'Fine Deducted', value: `-${penalty.toLocaleString()} ◈`, inline: true }],
        (m) => ({
          ...m,
          wallet: Math.max(0, m.wallet - penalty),
          gamesPlayed: m.gamesPlayed + 1,
        }),
        {
          memberId: activeMember.id,
          memberName: activeMember.displayName,
          type: 'heist',
          amount: -penalty,
          description: `Failed ${heistStrategy} /heist attempt`,
        }
      );
    }
  };

  // --- Mini-Game 4 Handler: Trivia ---
  const answerTrivia = (optIdx: number) => {
    const currentQ = TRIVIA_BANK[triviaIndex];
    if (optIdx === currentQ.correct) {
      setTriviaFeedback(
        `Correct! Awarded +${currentQ.reward} ◈ and +${currentQ.xp} XP.`
      );
      appendSandboxInteraction(
        `/trivia answer:${optIdx + 1}`,
        '🧠 Nextcord Dev Trivia — Correct Answer!',
        `Question: *${currentQ.q}*\nAnswer: **${currentQ.options[optIdx]}**`,
        '#10B981',
        [
          { name: 'Reward', value: `+${currentQ.reward} ◈`, inline: true },
          { name: 'XP Bonus', value: `+${currentQ.xp} XP`, inline: true },
        ],
        (m) => ({
          ...m,
          wallet: m.wallet + currentQ.reward,
          xp: m.xp + currentQ.xp,
          gamesPlayed: m.gamesPlayed + 1,
          gamesWon: m.gamesWon + 1,
        }),
        {
          memberId: activeMember.id,
          memberName: activeMember.displayName,
          type: 'game_win',
          amount: currentQ.reward,
          description: 'Answered /trivia challenge correctly',
        }
      );
    } else {
      setTriviaFeedback(
        `Incorrect. The right answer was "${currentQ.options[currentQ.correct]}".`
      );
    }
    setTimeout(() => {
      setTriviaIndex((prev) => (prev + 1) % TRIVIA_BANK.length);
    }, 1200);
  };

  const currentMinesMultiplier = calculateMinesMultiplier(
    minesRevealed.length,
    minesBombCount
  );

  return (
    <div className="space-y-6">
      {/* Active Member Context & Role-Based Permission Switcher */}
      <section
        aria-label="Active Discord Member & Role Switcher"
        className="bg-slate-900 border border-slate-800 rounded-xl p-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="text-xs text-slate-400">
              Simulated Discord Member Context · Test Role-Based Permissions (RBAC) Live
            </div>
            <h2 className="text-lg font-semibold text-slate-100 mt-0.5">
              Acting as {activeMember.displayName}{' '}
              <span className="text-sm font-normal text-slate-400">
                · @{activeMember.username} · Role: {activeRole.name}
              </span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="active-member-select" className="text-xs text-slate-400">
              Switch Member:
            </label>
            <select
              id="active-member-select"
              aria-label="Switch active simulated Discord member"
              value={activeMember.id}
              onChange={(e) =>
                onUpdateState((prev) => ({
                  ...prev,
                  activeMemberId: e.target.value,
                }))
              }
              className="bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              {state.members.map((m) => {
                const r = state.roles.find((role) => role.id === m.roleId);
                return (
                  <option key={m.id} value={m.id}>
                    {m.displayName} ({r?.name} · {m.wallet.toLocaleString()} ◈)
                  </option>
                );
              })}
            </select>

            <label htmlFor="active-role-select" className="text-xs text-slate-400 ml-2">
              Assign Role:
            </label>
            <select
              id="active-role-select"
              aria-label="Change active member role to test permissions"
              value={activeMember.roleId}
              onChange={(e) => {
                const newRoleId = e.target.value;
                onUpdateState((prev) => ({
                  ...prev,
                  members: prev.members.map((m) =>
                    m.id === activeMember.id ? { ...m, roleId: newRoleId } : m
                  ),
                }));
              }}
              className="bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
            >
              {state.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.xpMultiplier}x XP)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Member Live Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
          <div>
            <div className="text-xs text-slate-400">Wallet Balance</div>
            <div
              data-testid="active-wallet-balance"
              className="text-lg font-semibold font-mono tabular-nums text-emerald-400 mt-0.5"
            >
              {activeMember.wallet.toLocaleString()} ◈
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Bank Vault</div>
            <div className="text-lg font-semibold font-mono tabular-nums text-slate-100 mt-0.5">
              {activeMember.bank.toLocaleString()}{' '}
              <span className="text-xs text-slate-500">
                / {activeMember.bankCapacity.toLocaleString()} ◈
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">
              Level {levelInfo.level} Progress ({levelInfo.progressPercent}%)
            </div>
            <div
              data-testid="active-member-xp"
              className="text-sm font-mono tabular-nums text-indigo-300 mt-1"
            >
              {activeMember.xp.toLocaleString()} Total XP · {activeRole.xpMultiplier}x Rate
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Granted Role Permissions</div>
            <div className="text-xs text-slate-300 mt-1 truncate">
              {activeRole.permissions.join(' · ')}
            </div>
          </div>
        </div>
      </section>

      {/* Main Two-Column Split: Left = Discord #bot-commands Feed, Right = Interactive Nextcord ui.View Mini-Games */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Slash Command Channel Simulator (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between p-5">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-semibold text-slate-100">
                  #bot-commands · Nextcord Slash Terminal
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {state.sandboxMessages.length} events
              </span>
            </div>

            {/* Quick Slash Command Preset Buttons */}
            <div className="mt-3">
              <div className="text-xs text-slate-400 mb-2">
                One-Click Slash Commands (Click to execute as {activeMember.displayName}):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { cmd: '/daily', label: '/daily (Claim Stipend)' },
                  { cmd: '/work', label: '/work (Syndicate Shift)' },
                  { cmd: '/balance', label: '/balance' },
                  { cmd: '/rank', label: '/rank (XP Card)' },
                  { cmd: '/leaderboard', label: '/leaderboard' },
                  {
                    cmd: '/warn @dax_hollow Spamming links in general',
                    label: '/warn (Mod Check)',
                  },
                  {
                    cmd: '/timeout @zara_nyx Flood macro violation',
                    label: '/timeout (Mod Check)',
                  },
                ].map((item) => (
                  <button
                    key={item.cmd}
                    type="button"
                    onClick={() => {
                      setCommandInput(item.cmd);
                      executeSlashCommand(item.cmd);
                    }}
                    className="px-2.5 py-1.5 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Discord Embed Message Stream */}
            <div
              aria-label="Discord Bot Response Stream"
              className="mt-4 space-y-3 max-h-[430px] overflow-y-auto pr-1"
            >
              {state.sandboxMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-slate-950/90 border border-slate-800/90 rounded-lg p-3.5 text-sm"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-semibold"
                        style={{ color: msg.authorRoleColor }}
                      >
                        {msg.authorName}
                      </span>
                      <span>·</span>
                      <span className="font-mono text-indigo-300">
                        {msg.commandUsed}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-[11px] text-slate-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>

                  {msg.embed && (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-md p-3 mt-1">
                      <div className="font-semibold text-slate-100 text-sm">
                        {msg.embed.title}
                      </div>
                      <p className="text-xs text-slate-300 mt-1 whitespace-pre-line leading-relaxed">
                        {cleanDiscordText(msg.embed.description)}
                      </p>
                      {msg.embed.fields && msg.embed.fields.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 pt-2.5 border-t border-slate-800/80">
                          {msg.embed.fields.map((f, i) => (
                            <div key={i}>
                              <div className="text-[11px] text-slate-400">
                                {f.name}
                              </div>
                              <div className="text-xs font-mono tabular-nums font-medium text-slate-100 mt-0.5">
                                {f.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.embed.footer && (
                        <div className="text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-800/50">
                          {msg.embed.footer}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Custom Slash Command Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeSlashCommand(commandInput);
            }}
            className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2"
          >
            <label htmlFor="slash-command-input" className="sr-only">
              Slash Command Input
            </label>
            <input
              id="slash-command-input"
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="Type a slash command e.g. /daily, /work, /balance, /warn @user reason..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              Run Command
            </button>
          </form>
        </div>

        {/* Right Column: Interactive Nextcord ui.View Mini-Games Arena (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Interactive Mini-Games (nextcord.ui.View)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Wager & earn persistent Aether Shards (◈) and server XP
                </p>
              </div>
            </div>

            {/* Segmented Game Selector */}
            <div
              role="tablist"
              aria-label="Select Mini-Game"
              className="grid grid-cols-4 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg mt-3"
            >
              {[
                { id: 'mines', label: 'Aether Mines' },
                { id: 'blackjack', label: 'Blackjack' },
                { id: 'heist', label: 'Cyber Heist' },
                { id: 'trivia', label: 'Dev Trivia' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeGameTab === tab.id}
                  type="button"
                  onClick={() =>
                    setActiveGameTab(
                      tab.id as 'mines' | 'blackjack' | 'heist' | 'trivia'
                    )
                  }
                  className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeGameTab === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* GAME 1: 5x5 AETHER MINES */}
            {activeGameTab === 'mines' && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="mines-wager"
                      className="block text-xs text-slate-400 mb-1"
                    >
                      Shard Wager (◈)
                    </label>
                    <select
                      id="mines-wager"
                      disabled={minesActive}
                      value={minesWager}
                      onChange={(e) => setMinesWager(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100"
                    >
                      <option value={100}>100 ◈</option>
                      <option value={500}>500 ◈</option>
                      <option value={1000}>1,000 ◈</option>
                      <option value={2500}>2,500 ◈</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="mines-bombs"
                      className="block text-xs text-slate-400 mb-1"
                    >
                      Hidden Mines (Risk)
                    </label>
                    <select
                      id="mines-bombs"
                      disabled={minesActive}
                      value={minesBombCount}
                      onChange={(e) => setMinesBombCount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100"
                    >
                      <option value={3}>3 Mines (Low Risk)</option>
                      <option value={4}>4 Mines (Balanced)</option>
                      <option value={6}>6 Mines (High Yield)</option>
                      <option value={8}>8 Mines (Extreme)</option>
                    </select>
                  </div>
                </div>

                {/* 5x5 Button Matrix */}
                <div
                  data-testid="mines-grid"
                  className="grid grid-cols-5 gap-2 bg-slate-950 border border-slate-800 p-3 rounded-xl"
                >
                  {Array.from({ length: 25 }, (_, idx) => {
                    const isRevealed = minesRevealed.includes(idx);
                    const isBomb = minesBombs.includes(idx);
                    const showBomb =
                      (minesStatus === 'lost' || minesStatus === 'won') && isBomb;

                    let cellClasses =
                      'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-400';
                    let label = '·';

                    if (isRevealed && isBomb) {
                      cellClasses =
                        'bg-rose-950/90 border-rose-500 text-rose-300 font-bold';
                      label = '✖';
                    } else if (isRevealed) {
                      cellClasses =
                        'bg-emerald-950/90 border-emerald-500 text-emerald-300 font-bold';
                      label = '◈';
                    } else if (showBomb) {
                      cellClasses =
                        'bg-slate-900/60 border-rose-800/60 text-rose-400/70';
                      label = '✹';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        aria-label={`Mine tile ${idx + 1}`}
                        disabled={!minesActive || isRevealed}
                        onClick={() => clickMineTile(idx)}
                        className={`h-11 rounded-lg border font-mono text-sm transition-colors flex items-center justify-center ${cellClasses}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 flex items-center justify-between gap-2">
                  <span>{minesMessage}</span>
                  <span className="font-mono tabular-nums font-semibold text-indigo-300 shrink-0">
                    {currentMinesMultiplier}x
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {!minesActive ? (
                    <button
                      type="button"
                      onClick={startMinesGame}
                      className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Start Aether Mines ({minesWager.toLocaleString()} ◈)
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={minesRevealed.length === 0}
                      onClick={cashOutMines}
                      className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      Cash Out {Math.round(minesWager * currentMinesMultiplier).toLocaleString()} ◈ ({currentMinesMultiplier}x)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* GAME 2: BLACKJACK */}
            {activeGameTab === 'blackjack' && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="bj-wager" className="text-xs text-slate-400">
                    Table Wager (◈):
                  </label>
                  <select
                    id="bj-wager"
                    disabled={bjStatus === 'playing'}
                    value={bjWager}
                    onChange={(e) => setBjWager(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100"
                  >
                    <option value={250}>250 ◈</option>
                    <option value={500}>500 ◈</option>
                    <option value={1000}>1,000 ◈</option>
                    <option value={2500}>2,500 ◈</option>
                  </select>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div>
                    <div className="text-xs text-slate-400 mb-1.5">
                      Syndicate Dealer Hand{' '}
                      {bjDealerCards.length > 0 &&
                        `(${
                          bjStatus === 'playing'
                            ? `${bjDealerCards[0].value} + ?`
                            : evaluateBlackjackHand(bjDealerCards).total
                        })`}
                    </div>
                    <div className="flex gap-2 min-h-[48px]">
                      {bjDealerCards.length === 0 ? (
                        <span className="text-xs text-slate-500">
                          No cards dealt yet
                        </span>
                      ) : (
                        bjDealerCards.map((c, i) => (
                          <div
                            key={i}
                            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg font-mono text-sm font-semibold text-slate-100"
                          >
                            {bjStatus === 'playing' && i === 1
                              ? '🂠'
                              : `${c.rank}${c.suit}`}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800">
                    <div className="text-xs text-slate-400 mb-1.5">
                      {activeMember.displayName}&apos;s Hand{' '}
                      {bjPlayerCards.length > 0 &&
                        `(${evaluateBlackjackHand(bjPlayerCards).total})`}
                    </div>
                    <div className="flex gap-2 min-h-[48px]">
                      {bjPlayerCards.length === 0 ? (
                        <span className="text-xs text-slate-500">
                          Click Deal Hand below to begin
                        </span>
                      ) : (
                        bjPlayerCards.map((c, i) => (
                          <div
                            key={i}
                            className="px-3 py-2 bg-indigo-950/60 border border-indigo-500/40 rounded-lg font-mono text-sm font-semibold text-indigo-200"
                          >
                            {c.rank}
                            {c.suit}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-300">
                  {bjMessage}
                </div>

                {bjStatus !== 'playing' ? (
                  <button
                    type="button"
                    onClick={startBlackjack}
                    className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Deal Blackjack Hand ({bjWager.toLocaleString()} ◈)
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={hitBlackjack}
                      className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Hit (Draw Card)
                    </button>
                    <button
                      type="button"
                      onClick={standBlackjack}
                      className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Stand (Hold)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* GAME 3: CYBER VAULT HEIST */}
            {activeGameTab === 'heist' && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="heist-stake"
                      className="block text-xs text-slate-400 mb-1"
                    >
                      Crew Stake (◈)
                    </label>
                    <select
                      id="heist-stake"
                      value={heistWager}
                      onChange={(e) => setHeistWager(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100"
                    >
                      <option value={500}>500 ◈</option>
                      <option value={1000}>1,000 ◈</option>
                      <option value={2500}>2,500 ◈</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="heist-strategy"
                      className="block text-xs text-slate-400 mb-1"
                    >
                      Breach Protocol
                    </label>
                    <select
                      id="heist-strategy"
                      value={heistStrategy}
                      onChange={(e) =>
                        setHeistStrategy(e.target.value as 'stealth' | 'overclock')
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                    >
                      <option value="stealth">Stealth Bypass (62% · 1.85x)</option>
                      <option value="overclock">Overclock Blitz (48% · 2.6x)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs font-mono">
                  <div className="text-slate-400 pb-1.5 border-b border-slate-800 flex items-center justify-between">
                    <span>Heist Telemetry Log</span>
                    <span>
                      Cloak Owned:{' '}
                      {activeMember.inventory.includes('Heist Stealth Cloak')
                        ? 'YES (+15%)'
                        : 'NO'}
                    </span>
                  </div>
                  {heistResult.log.map((line, i) => (
                    <div key={i} className="text-slate-200 leading-relaxed">
                      {line}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={launchCyberHeist}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  Execute Cooperative Vault Heist ({heistWager.toLocaleString()} ◈)
                </button>
              </div>
            )}

            {/* GAME 4: NEXTCORD DEV TRIVIA */}
            {activeGameTab === 'trivia' && (
              <div className="mt-4 space-y-4">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Question #{triviaIndex + 1} of {TRIVIA_BANK.length}</span>
                    <span className="font-mono text-emerald-400">
                      +{TRIVIA_BANK[triviaIndex].reward} ◈ · +{TRIVIA_BANK[triviaIndex].xp} XP
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-100 leading-snug">
                    {TRIVIA_BANK[triviaIndex].q}
                  </p>

                  <div className="space-y-2 mt-4">
                    {TRIVIA_BANK[triviaIndex].options.map((opt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => answerTrivia(idx)}
                        className="w-full text-left px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/50 text-xs font-mono text-slate-200 transition-colors"
                      >
                        {idx + 1}. {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {triviaFeedback && (
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-indigo-300">
                    {triviaFeedback}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Games Won: {activeMember.gamesWon} / {activeMember.gamesPlayed}</span>
            <span className="font-mono tabular-nums">
              Win Rate:{' '}
              {activeMember.gamesPlayed > 0
                ? Math.round((activeMember.gamesWon / activeMember.gamesPlayed) * 100)
                : 0}
              %
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
