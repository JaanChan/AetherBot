export type PermissionKey =
  | 'use_slash_commands'
  | 'run_economy'
  | 'run_games'
  | 'mod_warn'
  | 'mod_timeout'
  | 'mod_kick'
  | 'mod_ban'
  | 'mod_purge'
  | 'manage_economy'
  | 'manage_welcome'
  | 'view_analytics';

export interface RoleConfig {
  id: string;
  name: string;
  color: string;
  hierarchy: number;
  permissions: PermissionKey[];
  xpMultiplier: number;
  dailyBonus: number;
}

export interface MemberProfile {
  id: string;
  username: string;
  displayName: string;
  tag: string;
  roleId: string;
  wallet: number;
  bank: number;
  bankCapacity: number;
  xp: number;
  level: number;
  messagesSent: number;
  commandsRun: number;
  gamesWon: number;
  gamesPlayed: number;
  dailyStreak: number;
  lastDailyClaim: string | null;
  inventory: string[];
  warningsCount: number;
  status: 'online' | 'idle' | 'dnd';
  joinedAt: string;
  avatarBg: string;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'boost' | 'role' | 'cosmetic' | 'utility';
  effectLabel: string;
  requiredLevel: number;
  roleRewardId?: string;
}

export interface TransactionRecord {
  id: string;
  memberId: string;
  memberName: string;
  type: 'daily' | 'work' | 'heist' | 'game_win' | 'game_loss' | 'shop_buy' | 'transfer' | 'admin_grant';
  amount: number;
  description: string;
  timestamp: string;
}

export interface LevelReward {
  level: number;
  roleId: string;
  roleName: string;
  shardBonus: number;
}

export interface LevelingConfig {
  xpPerMessageMin: number;
  xpPerMessageMax: number;
  xpCooldownSeconds: number;
  voiceXpPerMinute: number;
  levelUpChannel: string;
  announcementTemplate: string;
  rewards: LevelReward[];
}

export interface ModCase {
  id: string;
  caseNumber: number;
  targetId: string;
  targetName: string;
  moderatorId: string;
  moderatorName: string;
  action: 'warn' | 'timeout' | 'kick' | 'ban' | 'unban' | 'purge';
  reason: string;
  duration?: string;
  status: 'active' | 'resolved' | 'revoked';
  timestamp: string;
}

export interface AutoModRule {
  id: string;
  name: string;
  description: string;
  category: 'anti_spam' | 'link_guard' | 'raid_shield' | 'profanity' | 'mention_limit';
  enabled: boolean;
  thresholdLabel: string;
  thresholdValue: number;
  action: 'warn' | 'timeout' | 'kick' | 'delete_only';
  exemptRoleIds: string[];
  triggeredCount: number;
}

export interface WelcomeJoinPreview {
  id: string;
  username: string;
  memberNumber: number;
  inviter: string;
  renderedMessage: string;
  renderedTitle: string;
  renderedDescription: string;
  timestamp: string;
}

export interface WelcomeConfig {
  enabled: boolean;
  channelName: string;
  dmEnabled: boolean;
  autoRoleId: string;
  messageTemplate: string;
  embedTitle: string;
  embedDescription: string;
  embedColor: string;
  showMemberCount: boolean;
  showAvatarCard: boolean;
  bannerTheme: 'obsidian' | 'cobalt' | 'emerald' | 'amber';
  recentJoins: WelcomeJoinPreview[];
}

export interface DailyAnalyticsPoint {
  date: string;
  messages: number;
  commandsRun: number;
  newMembers: number;
  shardsMinted: number;
  shardsSpent: number;
  activeUsers: number;
}

export interface CommandMetric {
  command: string;
  cog: 'Economy' | 'MiniGames' | 'Leveling' | 'Moderation' | 'Welcome' | 'Utility';
  invocations: number;
  avgLatencyMs: number;
  successRate: number;
}

export interface SandboxEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface SandboxMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorRoleName: string;
  authorRoleColor: string;
  isBot: boolean;
  commandUsed?: string;
  content?: string;
  embed?: {
    title: string;
    description: string;
    color: string;
    fields?: SandboxEmbedField[];
    footer?: string;
    badge?: string;
  };
  timestamp: string;
}

export interface BotDatabaseState {
  guildName: string;
  guildId: string;
  botPrefix: string;
  activeMemberId: string;
  roles: RoleConfig[];
  members: MemberProfile[];
  shopItems: ShopItem[];
  transactions: TransactionRecord[];
  leveling: LevelingConfig;
  modCases: ModCase[];
  autoModRules: AutoModRule[];
  welcome: WelcomeConfig;
  analyticsSeries: DailyAnalyticsPoint[];
  commandMetrics: CommandMetric[];
  sandboxMessages: SandboxMessage[];
}
