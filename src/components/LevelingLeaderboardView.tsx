import React, { useState } from 'react';
import { BotDatabaseState, MemberProfile } from '../types/bot';
import { calculateLevelProgress } from '../utils/botEngine';
import { Trophy, Sparkles, Award, Sliders, Plus } from 'lucide-react';

interface LevelingLeaderboardViewProps {
  state: BotDatabaseState;
  onUpdateState: (updater: (prev: BotDatabaseState) => BotDatabaseState) => void;
}

export const LevelingLeaderboardView: React.FC<LevelingLeaderboardViewProps> = ({
  state,
  onUpdateState,
}) => {
  const [sortBy, setSortBy] = useState<'xp' | 'wealth' | 'games' | 'messages'>(
    'xp'
  );
  const [inspectedMemberId, setInspectedMemberId] = useState<string>(
    state.activeMemberId
  );

  // Add Milestone Reward form state
  const [newMilestoneLevel, setNewMilestoneLevel] = useState('15');
  const [newMilestoneRoleId, setNewMilestoneRoleId] = useState('role-vanguard');
  const [newMilestoneBonus, setNewMilestoneBonus] = useState('5000');

  const sortedMembers = [...state.members].sort((a, b) => {
    if (sortBy === 'xp') return b.xp - a.xp;
    if (sortBy === 'wealth') return b.wallet + b.bank - (a.wallet + a.bank);
    if (sortBy === 'games') return b.gamesWon - a.gamesWon;
    return b.messagesSent - a.messagesSent;
  });

  const inspectedMember: MemberProfile =
    state.members.find((m) => m.id === inspectedMemberId) || sortedMembers[0];
  const inspectedRole =
    state.roles.find((r) => r.id === inspectedMember.roleId) || state.roles[0];
  const inspectedProgress = calculateLevelProgress(inspectedMember.xp);
  const inspectedRankIndex =
    [...state.members]
      .sort((a, b) => b.xp - a.xp)
      .findIndex((m) => m.id === inspectedMember.id) + 1;

  const grantXpBurst = (memberId: string, amount: number) => {
    onUpdateState((prev) => ({
      ...prev,
      members: prev.members.map((m) => {
        if (m.id !== memberId) return m;
        const nextXp = m.xp + amount;
        const nextLvl = calculateLevelProgress(nextXp).level;
        // Check if any milestone reward was unlocked
        const unlockedReward = prev.leveling.rewards
          .filter((r) => r.level > m.level && r.level <= nextLvl)
          .sort((a, b) => b.level - a.level)[0];

        return {
          ...m,
          xp: nextXp,
          level: nextLvl,
          wallet: m.wallet + (unlockedReward ? unlockedReward.shardBonus : 0),
          roleId: unlockedReward ? unlockedReward.roleId : m.roleId,
        };
      }),
    }));
  };

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    const lvl = Math.max(1, Math.floor(Number(newMilestoneLevel)));
    const bonus = Math.max(0, Math.floor(Number(newMilestoneBonus)));
    const roleObj =
      state.roles.find((r) => r.id === newMilestoneRoleId) || state.roles[0];

    onUpdateState((prev) => ({
      ...prev,
      leveling: {
        ...prev.leveling,
        rewards: [
          ...prev.leveling.rewards.filter((r) => r.level !== lvl),
          {
            level: lvl,
            roleId: roleObj.id,
            roleName: roleObj.name,
            shardBonus: bonus,
          },
        ].sort((a, b) => a.level - b.level),
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Top Split: Left = Live /rank Card Generator & Config, Right = Interactive Guild Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Live /rank Card & Leveling Rate Configurator (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Live /rank Profile Card Preview
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rendered via Pillow / SVG in cogs/leveling.py
                </p>
              </div>
              <button
                type="button"
                onClick={() => grantXpBurst(inspectedMember.id, 600)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Grant +600 XP
              </button>
            </div>

            {/* Bespoke Discord /rank Card Surface */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-display font-bold text-lg shrink-0"
                    style={{ backgroundColor: inspectedMember.avatarBg }}
                  >
                    {inspectedMember.displayName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-slate-100">
                      {inspectedMember.displayName}
                    </div>
                    <div className="text-xs text-slate-400">
                      @{inspectedMember.username} ·{' '}
                      <span style={{ color: inspectedRole.color }}>
                        {inspectedRole.name}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono tabular-nums">
                  <div className="text-xs text-slate-400">
                    RANK #{inspectedRankIndex}
                  </div>
                  <div className="text-xl font-bold text-indigo-400">
                    LEVEL {inspectedProgress.level}
                  </div>
                </div>
              </div>

              {/* XP Progress Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-300 mb-1.5">
                  <span>
                    {inspectedProgress.currentLevelXp.toLocaleString()} /{' '}
                    {inspectedProgress.nextLevelXp.toLocaleString()} XP to Level{' '}
                    {inspectedProgress.level + 1}
                  </span>
                  <span className="text-indigo-300">
                    {inspectedProgress.progressPercent}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-200"
                    style={{ width: `${inspectedProgress.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Card Bottom Telemetry */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-900 text-xs font-mono tabular-nums">
                <div>
                  <span className="text-slate-500 block text-[11px]">
                    Cumulative XP
                  </span>
                  <span className="text-slate-200 font-semibold">
                    {inspectedMember.xp.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">
                    Net Worth
                  </span>
                  <span className="text-emerald-400 font-semibold">
                    {(
                      inspectedMember.wallet + inspectedMember.bank
                    ).toLocaleString()}{' '}
                    ◈
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">
                    Messages Sent
                  </span>
                  <span className="text-slate-200 font-semibold">
                    {inspectedMember.messagesSent.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Leveling Curve Parameters */}
            <div className="pt-2 space-y-3">
              <div className="text-xs font-semibold text-slate-300">
                XP Curve & Cooldown Parameters (cogs/leveling.py)
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label
                    htmlFor="xp-min-input"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Min XP / Msg
                  </label>
                  <input
                    id="xp-min-input"
                    type="number"
                    min={1}
                    value={state.leveling.xpPerMessageMin}
                    onChange={(e) =>
                      onUpdateState((prev) => ({
                        ...prev,
                        leveling: {
                          ...prev.leveling,
                          xpPerMessageMin: Math.max(1, Number(e.target.value)),
                        },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="xp-max-input"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Max XP / Msg
                  </label>
                  <input
                    id="xp-max-input"
                    type="number"
                    min={5}
                    value={state.leveling.xpPerMessageMax}
                    onChange={(e) =>
                      onUpdateState((prev) => ({
                        ...prev,
                        leveling: {
                          ...prev.leveling,
                          xpPerMessageMax: Math.max(5, Number(e.target.value)),
                        },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="xp-cooldown-input"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Cooldown (s)
                  </label>
                  <input
                    id="xp-cooldown-input"
                    type="number"
                    min={5}
                    value={state.leveling.xpCooldownSeconds}
                    onChange={(e) =>
                      onUpdateState((prev) => ({
                        ...prev,
                        leveling: {
                          ...prev.leveling,
                          xpCooldownSeconds: Math.max(5, Number(e.target.value)),
                        },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Role Milestone Rewards */}
          <form
            onSubmit={handleAddMilestone}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"
          >
            <div className="pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-slate-100">
                Level-Up Role & Shard Milestones
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically assigns roles and Aether Shards when members cross level thresholds
              </p>
            </div>

            <div className="divide-y divide-slate-800">
              {state.leveling.rewards.map((rw) => (
                <div
                  key={rw.level}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-mono font-semibold text-indigo-300">
                      Level {rw.level}
                    </span>
                    <span className="text-slate-500 mx-2">·</span>
                    <span className="text-slate-200 font-medium">
                      Unlocks {rw.roleName}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-emerald-400">
                    +{rw.shardBonus.toLocaleString()} ◈
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
              <div>
                <label
                  htmlFor="milestone-lvl"
                  className="block text-[11px] text-slate-400 mb-1"
                >
                  Target Level
                </label>
                <input
                  id="milestone-lvl"
                  type="number"
                  min={1}
                  value={newMilestoneLevel}
                  onChange={(e) => setNewMilestoneLevel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="milestone-role"
                  className="block text-[11px] text-slate-400 mb-1"
                >
                  Role Reward
                </label>
                <select
                  id="milestone-role"
                  value={newMilestoneRoleId}
                  onChange={(e) => setNewMilestoneRoleId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100"
                >
                  {state.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="milestone-bonus"
                  className="block text-[11px] text-slate-400 mb-1"
                >
                  Shard Bonus
                </label>
                <input
                  id="milestone-bonus"
                  type="number"
                  min={0}
                  value={newMilestoneBonus}
                  onChange={(e) => setNewMilestoneBonus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Save Level Milestone
            </button>
          </form>
        </div>

        {/* Right: Guild Leaderboard Table (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                {state.guildName} · Engagement Leaderboard (/leaderboard)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Click any member row to inspect their /rank card or grant XP
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
              {[
                { id: 'xp', label: 'By Level & XP' },
                { id: 'wealth', label: 'By Net Worth' },
                { id: 'games', label: 'By Game Wins' },
                { id: 'messages', label: 'By Messages' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setSortBy(
                      tab.id as 'xp' | 'wealth' | 'games' | 'messages'
                    )
                  }
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    sortBy === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                  <th className="py-2.5 pr-3 font-medium">Rank</th>
                  <th className="py-2.5 px-3 font-medium">Guild Member</th>
                  <th className="py-2.5 px-3 font-medium text-right">Level & XP</th>
                  <th className="py-2.5 px-3 font-medium text-right">Net Worth</th>
                  <th className="py-2.5 px-3 font-medium text-right">Mini-Games</th>
                  <th className="py-2.5 pl-3 font-medium text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {sortedMembers.map((member, idx) => {
                  const prog = calculateLevelProgress(member.xp);
                  const role = state.roles.find((r) => r.id === member.roleId);
                  const isSelected = member.id === inspectedMember.id;
                  return (
                    <tr
                      key={member.id}
                      onClick={() => setInspectedMemberId(member.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-950/30'
                          : 'hover:bg-slate-950/60'
                      }`}
                    >
                      <td className="py-3 pr-3 font-mono tabular-nums font-semibold text-slate-300">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-100">
                          {member.displayName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          @{member.username} · {role?.name}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <div className="text-indigo-300 font-semibold">
                          Lv.{prog.level}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {member.xp.toLocaleString()} XP
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-400 font-semibold">
                        {(member.wallet + member.bank).toLocaleString()} ◈
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-300">
                        {member.gamesWon}W / {member.gamesPlayed}G
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            grantXpBurst(member.id, 500);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-md font-mono text-[11px] transition-colors whitespace-nowrap shrink-0"
                        >
                          +500 XP
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
