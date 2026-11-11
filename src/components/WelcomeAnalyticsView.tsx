import React, { useState } from 'react';
import { BotDatabaseState } from '../types/bot';
import {
  buildWelcomePreview,
  formatWelcomeTemplate,
  cleanDiscordText,
} from '../utils/botEngine';
import {
  UserPlus,
  Sparkles,
  BarChart3,
  MessageSquare,
  Activity,
  Users,
} from 'lucide-react';

interface WelcomeAnalyticsViewProps {
  state: BotDatabaseState;
  onUpdateState: (updater: (prev: BotDatabaseState) => BotDatabaseState) => void;
}

export const WelcomeAnalyticsView: React.FC<WelcomeAnalyticsViewProps> = ({
  state,
  onUpdateState,
}) => {
  const [simUsername, setSimUsername] = useState('orion_pulse');
  const [simInviter, setSimInviter] = useState('kaelen_vex');
  const [chartMetric, setChartMetric] = useState<
    'engagement' | 'economy' | 'members'
  >('engagement');

  const autoRoleObj =
    state.roles.find((r) => r.id === state.welcome.autoRoleId) ||
    state.roles[3];

  const nextMemberNumber =
    1428 + state.welcome.recentJoins.length;

  const livePreviewContext = {
    user: `@${simUsername || 'new_explorer'}`,
    server: state.guildName,
    memberCount: nextMemberNumber,
    inviter: `@${simInviter || 'kaelen_vex'}`,
    role: autoRoleObj.name,
  };

  const handleSimulateJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = simUsername.trim() || `explorer_${Math.floor(Math.random() * 900 + 100)}`;
    const preview = buildWelcomePreview(
      state.welcome,
      state.guildName,
      cleanUser,
      nextMemberNumber,
      simInviter.trim() || 'kaelen_vex',
      autoRoleObj.name
    );

    onUpdateState((prev) => ({
      ...prev,
      welcome: {
        ...prev.welcome,
        recentJoins: [preview, ...prev.welcome.recentJoins].slice(0, 8),
      },
      analyticsSeries: prev.analyticsSeries.map((pt, idx, arr) =>
        idx === arr.length - 1
          ? { ...pt, newMembers: pt.newMembers + 1, activeUsers: pt.activeUsers + 1 }
          : pt
      ),
    }));
  };

  const total7dMessages = state.analyticsSeries.reduce(
    (s, p) => s + p.messages,
    0
  );
  const total7dCommands = state.analyticsSeries.reduce(
    (s, p) => s + p.commandsRun,
    0
  );
  const total7dNewMembers = state.analyticsSeries.reduce(
    (s, p) => s + p.newMembers,
    0
  );
  const total7dMinted = state.analyticsSeries.reduce(
    (s, p) => s + p.shardsMinted,
    0
  );

  const bannerThemeClasses: Record<string, string> = {
    cobalt: 'from-indigo-950 via-slate-900 to-slate-950 border-indigo-500/40',
    obsidian: 'from-slate-900 via-slate-950 to-neutral-950 border-slate-700',
    emerald: 'from-emerald-950 via-slate-900 to-slate-950 border-emerald-500/40',
    amber: 'from-amber-950 via-slate-900 to-slate-950 border-amber-500/40',
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: Customizable Welcome Messages & Live Discord Embed Preview */}
      <section aria-label="Customizable Welcome Messages Studio" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Customizable Welcome Studio (on_member_join)
            </h2>
            <p className="text-xs text-slate-400">
              Configure dynamic member onboarding templates, auto-roles, and live Discord welcome embeds
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Target Channel: <span className="text-indigo-300">{state.welcome.channelName}</span> · Auto-Role:{' '}
            <span className="text-emerald-400">{autoRoleObj.name}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Welcome Configuration Controls (6 cols) */}
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="text-sm font-semibold text-slate-100">
                Welcome Event & Template Settings
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateState((prev) => ({
                    ...prev,
                    welcome: {
                      ...prev.welcome,
                      enabled: !prev.welcome.enabled,
                    },
                  }))
                }
                className={`px-3 py-1 text-xs font-mono rounded-md border transition-colors ${
                  state.welcome.enabled
                    ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300'
                    : 'bg-slate-950 border-slate-700 text-slate-400'
                }`}
              >
                {state.welcome.enabled ? 'WELCOME ACTIVE' : 'WELCOME PAUSED'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="welcome-channel"
                  className="block text-xs text-slate-400 mb-1"
                >
                  Welcome Channel
                </label>
                <input
                  id="welcome-channel"
                  type="text"
                  value={state.welcome.channelName}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      welcome: { ...prev.welcome, channelName: e.target.value },
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="welcome-autorole"
                  className="block text-xs text-slate-400 mb-1"
                >
                  Auto-Assign Role
                </label>
                <select
                  id="welcome-autorole"
                  value={state.welcome.autoRoleId}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      welcome: { ...prev.welcome, autoRoleId: e.target.value },
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
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
                  htmlFor="welcome-banner-theme"
                  className="block text-xs text-slate-400 mb-1"
                >
                  Card Banner Theme
                </label>
                <select
                  id="welcome-banner-theme"
                  value={state.welcome.bannerTheme}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      welcome: {
                        ...prev.welcome,
                        bannerTheme: e.target.value as
                          | 'obsidian'
                          | 'cobalt'
                          | 'emerald'
                          | 'amber',
                      },
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100"
                >
                  <option value="cobalt">Cobalt Horizon</option>
                  <option value="obsidian">Obsidian Grid</option>
                  <option value="emerald">Emerald Matrix</option>
                  <option value="amber">Solaris Gold</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="welcome-msg-template"
                className="block text-xs text-slate-400 mb-1"
              >
                Channel Greeting Message ({'{user}'}, {'{server}'}, {'{member_count}'}, {'{inviter}'})
              </label>
              <input
                id="welcome-msg-template"
                type="text"
                value={state.welcome.messageTemplate}
                onChange={(e) =>
                  onUpdateState((prev) => ({
                    ...prev,
                    welcome: {
                      ...prev.welcome,
                      messageTemplate: e.target.value,
                    },
                  }))
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="welcome-embed-title"
                className="block text-xs text-slate-400 mb-1"
              >
                Embed Headline
              </label>
              <input
                id="welcome-embed-title"
                type="text"
                value={state.welcome.embedTitle}
                onChange={(e) =>
                  onUpdateState((prev) => ({
                    ...prev,
                    welcome: { ...prev.welcome, embedTitle: e.target.value },
                  }))
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="welcome-embed-desc"
                className="block text-xs text-slate-400 mb-1"
              >
                Embed Body Description ({'{role}'} supported)
              </label>
              <textarea
                id="welcome-embed-desc"
                rows={3}
                value={state.welcome.embedDescription}
                onChange={(e) =>
                  onUpdateState((prev) => ({
                    ...prev,
                    welcome: {
                      ...prev.welcome,
                      embedDescription: e.target.value,
                    },
                  }))
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>

            {/* Simulate Member Join Trigger */}
            <form
              onSubmit={handleSimulateJoin}
              className="pt-3 border-t border-slate-800 space-y-3"
            >
              <div className="text-xs font-semibold text-slate-300">
                Test on_member_join Event in {state.welcome.channelName}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="sim-username"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Joining Username
                  </label>
                  <input
                    id="sim-username"
                    type="text"
                    value={simUsername}
                    onChange={(e) => setSimUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sim-inviter"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Invited By
                  </label>
                  <input
                    id="sim-inviter"
                    type="text"
                    value={simInviter}
                    onChange={(e) => setSimInviter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-100"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Simulate Member Join Event (#{nextMemberNumber})
              </button>
            </form>
          </div>

          {/* Right: Live Discord Welcome Embed Preview & Recent Joins Log (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="text-sm font-semibold text-slate-100">
                  Live {state.welcome.channelName} Discord Render Preview
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Member #{nextMemberNumber}
                </span>
              </div>

              {/* Simulated Discord Welcome Message & Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-indigo-400">
                    AetherBot
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    BOT · Today at 10:15 AM
                  </span>
                </div>

                <p
                  data-testid="welcome-rendered-message"
                  className="text-xs text-slate-200 leading-relaxed"
                >
                  {cleanDiscordText(
                    formatWelcomeTemplate(
                      state.welcome.messageTemplate,
                      livePreviewContext
                    )
                  )}
                </p>

                {/* Rendered Embed + Welcome Banner Card */}
                <div
                  className={`rounded-xl border bg-gradient-to-br p-4 space-y-3 ${
                    bannerThemeClasses[state.welcome.bannerTheme] ||
                    bannerThemeClasses.cobalt
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-indigo-600/80 border border-indigo-400/50 flex items-center justify-center text-white font-display font-bold text-sm">
                        {(simUsername || 'N')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {cleanDiscordText(
                            formatWelcomeTemplate(
                              state.welcome.embedTitle,
                              livePreviewContext
                            )
                          )}
                        </div>
                        <div className="text-xs text-slate-300 mt-0.5">
                          Assigned Role: {autoRoleObj.name} · Member #{nextMemberNumber}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed">
                    {cleanDiscordText(
                      formatWelcomeTemplate(
                        state.welcome.embedDescription,
                        livePreviewContext
                      )
                    )}
                  </p>
                </div>
              </div>

              {/* Recent Joins Stream */}
              <div className="pt-2">
                <div className="text-xs font-semibold text-slate-400 mb-2">
                  Recent Simulated Member Joins ({state.welcome.recentJoins.length})
                </div>
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {state.welcome.recentJoins.map((jn) => (
                    <div
                      key={jn.id}
                      className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <span className="font-semibold text-indigo-300">
                          @{jn.username}
                        </span>
                        <span className="text-slate-500 mx-1.5">·</span>
                        <span className="text-slate-300">
                          {cleanDiscordText(jn.renderedMessage)}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-[11px] text-slate-500 shrink-0">
                        #{jn.memberNumber}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Detailed Server Analytics & Command Telemetry */}
      <section aria-label="Detailed Server Analytics" className="space-y-4 pt-2 border-t border-slate-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Detailed Server Analytics & Command Telemetry
            </h2>
            <p className="text-xs text-slate-400">
              7-day guild activity, slash command latency metrics, and virtual currency velocity
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            {[
              { id: 'engagement', label: 'Messages & Slash Commands' },
              { id: 'economy', label: 'Shards Minted vs Spent' },
              { id: 'members', label: 'Active & New Members' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  setChartMetric(m.id as 'engagement' | 'economy' | 'members')
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  chartMetric === m.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4-Card KPI Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">7-Day Guild Messages</div>
            <div className="text-2xl font-semibold font-mono tabular-nums text-slate-100 mt-1">
              {total7dMessages.toLocaleString()}
            </div>
            <div className="text-xs text-emerald-400 mt-1 font-mono">
              +18.4% vs prior 7d
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">Slash Commands Invoked</div>
            <div className="text-2xl font-semibold font-mono tabular-nums text-indigo-300 mt-1">
              {total7dCommands.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono">
              45.8ms avg gateway latency
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">New Member Joins (7d)</div>
            <div className="text-2xl font-semibold font-mono tabular-nums text-emerald-400 mt-1">
              +{total7dNewMembers.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              96.2% verified auto-role retention
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400">7-Day Shards Minted</div>
            <div className="text-2xl font-semibold font-mono tabular-nums text-amber-300 mt-1">
              {total7dMinted.toLocaleString()} ◈
            </div>
            <div className="text-xs text-slate-400 mt-1">
              81.1% sink ratio via Shop & Mines
            </div>
          </div>
        </div>

        {/* Interactive SVG Chart + Command Breakdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Interactive SVG Bar/Area Telemetry Chart (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="text-sm font-semibold text-slate-100">
                {chartMetric === 'engagement' &&
                  'Daily Message Traffic vs. Slash Command Invocations'}
                {chartMetric === 'economy' &&
                  'Daily Virtual Currency Velocity (Minted vs. Spent Shards)'}
                {chartMetric === 'members' &&
                  'Daily Active Members & New Member Onboarding'}
              </div>
              <BarChart3 className="w-4 h-4 text-indigo-400" />
            </div>

            <div className="grid grid-cols-7 gap-3 pt-4 h-56 items-end">
              {state.analyticsSeries.map((pt) => {
                let primaryVal = pt.messages;
                let secondaryVal = pt.commandsRun;
                let maxVal = 6500;
                let unit = '';

                if (chartMetric === 'economy') {
                  primaryVal = pt.shardsMinted;
                  secondaryVal = pt.shardsSpent;
                  maxVal = 100000;
                  unit = '◈';
                } else if (chartMetric === 'members') {
                  primaryVal = pt.activeUsers;
                  secondaryVal = pt.newMembers * 5;
                  maxVal = 600;
                }

                const h1 = Math.max(12, Math.round((primaryVal / maxVal) * 160));
                const h2 = Math.max(8, Math.round((secondaryVal / maxVal) * 160));

                return (
                  <div
                    key={pt.date}
                    className="flex flex-col items-center gap-2 h-full justify-end"
                  >
                    <div className="text-[11px] font-mono tabular-nums text-slate-300">
                      {primaryVal.toLocaleString()}
                      {unit}
                    </div>
                    <div className="w-full flex items-end justify-center gap-1.5 h-40 bg-slate-950/60 border border-slate-800/70 rounded-lg p-1.5">
                      <div
                        className="w-1/2 bg-indigo-500 rounded-sm transition-all duration-200"
                        style={{ height: `${h1}px` }}
                        title={`Primary: ${primaryVal.toLocaleString()}`}
                      />
                      <div
                        className="w-1/2 bg-emerald-500/80 rounded-sm transition-all duration-200"
                        style={{ height: `${h2}px` }}
                        title={`Secondary: ${secondaryVal.toLocaleString()}`}
                      />
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      {pt.date}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Per-Cog Command Telemetry Table (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100">
                Slash Command Performance by Cog
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                    <th className="py-2 pr-2 font-medium">Command</th>
                    <th className="py-2 px-2 font-medium">Cog</th>
                    <th className="py-2 px-2 font-medium text-right">Calls</th>
                    <th className="py-2 pl-2 font-medium text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {state.commandMetrics.map((cm) => (
                    <tr key={cm.command} className="hover:bg-slate-950/60">
                      <td className="py-2.5 pr-2 font-mono font-semibold text-indigo-300">
                        {cm.command}
                      </td>
                      <td className="py-2.5 px-2 text-slate-400">{cm.cog}</td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-200">
                        {cm.invocations.toLocaleString()}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-mono tabular-nums text-emerald-400">
                        {cm.avgLatencyMs}ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
