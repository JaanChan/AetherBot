import React, { useState } from 'react';
import {
  BotDatabaseState,
  ModCase,
  PermissionKey,
} from '../types/bot';
import { hasRolePermission } from '../utils/botEngine';
import {
  Shield,
  ShieldAlert,
  Lock,
  CheckCircle2,
  AlertCircle,
  Sliders,
} from 'lucide-react';

interface ModerationRbacViewProps {
  state: BotDatabaseState;
  onUpdateState: (updater: (prev: BotDatabaseState) => BotDatabaseState) => void;
}

const ALL_PERMISSIONS: { key: PermissionKey; label: string; group: string }[] = [
  { key: 'use_slash_commands', label: 'Use Slash Commands', group: 'General' },
  { key: 'run_economy', label: 'Economy (/daily, /work, /shop)', group: 'Economy' },
  { key: 'run_games', label: 'Mini-Games (/mines, /blackjack)', group: 'Games' },
  { key: 'mod_warn', label: 'Issue Warnings (/warn)', group: 'Moderation' },
  { key: 'mod_timeout', label: 'Timeout Members (/timeout)', group: 'Moderation' },
  { key: 'mod_kick', label: 'Kick Members (/kick)', group: 'Moderation' },
  { key: 'mod_ban', label: 'Ban Members (/ban)', group: 'Moderation' },
  { key: 'mod_purge', label: 'Bulk Purge Messages (/purge)', group: 'Moderation' },
  { key: 'manage_economy', label: 'Manage Shop & Mint Shards', group: 'Admin' },
  { key: 'manage_welcome', label: 'Configure Welcome Studio', group: 'Admin' },
  { key: 'view_analytics', label: 'View Server Analytics', group: 'Analytics' },
];

export const ModerationRbacView: React.FC<ModerationRbacViewProps> = ({
  state,
  onUpdateState,
}) => {
  const activeMember =
    state.members.find((m) => m.id === state.activeMemberId) || state.members[0];
  const activeRole =
    state.roles.find((r) => r.id === activeMember.roleId) || state.roles[0];

  const [targetMemberId, setTargetMemberId] = useState<string>('mem-5');
  const [modAction, setModAction] = useState<
    'warn' | 'timeout' | 'kick' | 'ban' | 'purge'
  >('warn');
  const [modDuration, setModDuration] = useState<string>('30m');
  const [modReason, setModReason] = useState<string>('');
  const [modFeedback, setModFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const [caseFilter, setCaseFilter] = useState<
    'all' | 'active' | 'resolved' | 'revoked'
  >('all');
  const [selectedRoleIdForRbac, setSelectedRoleIdForRbac] = useState<string>(
    state.roles[1]?.id || state.roles[0].id
  );

  const selectedRoleForRbac =
    state.roles.find((r) => r.id === selectedRoleIdForRbac) || state.roles[0];

  const handleDispatchModeration = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedReason = modReason.trim();
    if (!trimmedReason) {
      setModFeedback({
        type: 'err',
        text: 'Please provide an audit reason before logging a moderation case.',
      });
      return;
    }

    const permMap: Record<string, PermissionKey> = {
      warn: 'mod_warn',
      timeout: 'mod_timeout',
      kick: 'mod_kick',
      ban: 'mod_ban',
      purge: 'mod_purge',
    };
    const requiredPerm = permMap[modAction];

    if (!hasRolePermission(activeMember, state.roles, requiredPerm)) {
      setModFeedback({
        type: 'err',
        text: `Permission Denied: Active member ${activeMember.displayName} (${activeRole.name}) lacks "${requiredPerm}".`,
      });
      return;
    }

    const target =
      state.members.find((m) => m.id === targetMemberId) || state.members[0];
    const nextCaseNum =
      state.modCases.reduce((max, c) => Math.max(max, c.caseNumber), 100) + 1;

    const newCase: ModCase = {
      id: `case-${Date.now()}`,
      caseNumber: nextCaseNum,
      targetId: target.id,
      targetName: target.displayName,
      moderatorId: activeMember.id,
      moderatorName: activeMember.displayName,
      action: modAction,
      reason: trimmedReason,
      duration: modAction === 'timeout' ? modDuration : undefined,
      status: 'active',
      timestamp: new Date().toISOString(),
    };

    onUpdateState((prev) => ({
      ...prev,
      modCases: [newCase, ...prev.modCases],
      members: prev.members.map((m) =>
        m.id === target.id
          ? {
              ...m,
              warningsCount:
                modAction === 'warn' ? m.warningsCount + 1 : m.warningsCount,
            }
          : m
      ),
    }));

    setModReason('');
    setModFeedback({
      type: 'ok',
      text: `Logged Case #${nextCaseNum} (${modAction.toUpperCase()}) against ${target.displayName}.`,
    });
  };

  const updateCaseStatus = (
    caseId: string,
    newStatus: 'active' | 'resolved' | 'revoked'
  ) => {
    onUpdateState((prev) => ({
      ...prev,
      modCases: prev.modCases.map((c) =>
        c.id === caseId ? { ...c, status: newStatus } : c
      ),
    }));
  };

  const togglePermissionOnRole = (roleId: string, permKey: PermissionKey) => {
    onUpdateState((prev) => ({
      ...prev,
      roles: prev.roles.map((r) => {
        if (r.id !== roleId) return r;
        const exists = r.permissions.includes(permKey);
        return {
          ...r,
          permissions: exists
            ? r.permissions.filter((p) => p !== permKey)
            : [...r.permissions, permKey],
        };
      }),
    }));
  };

  const filteredCases = state.modCases.filter((c) =>
    caseFilter === 'all' ? true : c.status === caseFilter
  );

  return (
    <div className="space-y-6">
      {/* Top Split: Left = Slash Moderation Dispatcher & AutoMod, Right = Audit Log Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Dispatch Action Form + AutoMod Rules (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleDispatchModeration}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Dispatch Moderation Action
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Acting Moderator: {activeMember.displayName} ({activeRole.name})
                </p>
              </div>
              <Shield className="w-4 h-4 text-indigo-400" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="mod-target-select"
                  className="block text-xs text-slate-400 mb-1"
                >
                  Target Member
                </label>
                <select
                  id="mod-target-select"
                  value={targetMemberId}
                  onChange={(e) => setTargetMemberId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
                >
                  {state.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} ({m.warningsCount} warns)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="mod-action-select"
                  className="block text-xs text-slate-400 mb-1"
                >
                  Slash Command Action
                </label>
                <select
                  id="mod-action-select"
                  value={modAction}
                  onChange={(e) =>
                    setModAction(
                      e.target.value as
                        | 'warn'
                        | 'timeout'
                        | 'kick'
                        | 'ban'
                        | 'purge'
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
                >
                  <option value="warn">/warn (Official Warning)</option>
                  <option value="timeout">/timeout (Communication Mute)</option>
                  <option value="kick">/kick (Remove from Guild)</option>
                  <option value="ban">/ban (Permanent Guild Ban)</option>
                  <option value="purge">/purge (Channel Cleanup)</option>
                </select>
              </div>
            </div>

            {modAction === 'timeout' && (
              <div>
                <label
                  htmlFor="mod-duration-select"
                  className="block text-xs text-slate-400 mb-1"
                >
                  Timeout Duration
                </label>
                <select
                  id="mod-duration-select"
                  value={modDuration}
                  onChange={(e) => setModDuration(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
                >
                  <option value="10m">10 Minutes</option>
                  <option value="30m">30 Minutes</option>
                  <option value="1h">1 Hour</option>
                  <option value="24h">24 Hours</option>
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor="mod-reason-input"
                className="block text-xs text-slate-400 mb-1"
              >
                Audit Log Reason (Required)
              </label>
              <input
                id="mod-reason-input"
                type="text"
                value={modReason}
                onChange={(e) => setModReason(e.target.value)}
                placeholder="Describe rule violation or context for audit trail..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100"
              />
            </div>

            {modFeedback && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  modFeedback.type === 'ok'
                    ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300'
                    : 'bg-rose-950/50 border-rose-700/60 text-rose-300'
                }`}
              >
                {modFeedback.type === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{modFeedback.text}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Log Moderation Case (/{modAction})
            </button>
          </form>

          {/* AutoMod Rule Suite */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="pb-3 border-b border-slate-800">
              <h3 className="text-base font-semibold text-slate-100">
                AutoMod Automated Guard Rules
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time Nextcord on_message & on_member_join automated filters
              </p>
            </div>

            <div className="divide-y divide-slate-800">
              {state.autoModRules.map((rule) => (
                <div key={rule.id} className="py-3 first:pt-1 last:pb-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-100">
                        {rule.name}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {rule.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Toggle ${rule.name}`}
                      onClick={() =>
                        onUpdateState((prev) => ({
                          ...prev,
                          autoModRules: prev.autoModRules.map((r) =>
                            r.id === rule.id ? { ...r, enabled: !r.enabled } : r
                          ),
                        }))
                      }
                      className={`px-3 py-1 text-xs font-mono rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                        rule.enabled
                          ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300'
                          : 'bg-slate-950 border-slate-700 text-slate-400'
                      }`}
                    >
                      {rule.enabled ? 'ENABLED' : 'DISABLED'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>
                      {rule.thresholdLabel}:{' '}
                      <strong className="font-mono text-slate-200">
                        {rule.thresholdValue}
                      </strong>{' '}
                      · Penalty:{' '}
                      <strong className="font-mono text-amber-300 uppercase">
                        {rule.action}
                      </strong>
                    </span>
                    <span className="font-mono tabular-nums">
                      {rule.triggeredCount} interceptions
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Active Moderation Audit Cases + RBAC Permission Matrix (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Moderation Case Audit Log (mod_cases)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Persistent record of all slash moderation actions with resolution controls
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                {(['all', 'active', 'resolved', 'revoked'] as const).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setCaseFilter(st)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap shrink-0 ${
                        caseFilter === st
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-800">
              {filteredCases.map((c) => (
                <div
                  key={c.id}
                  className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-indigo-300">
                        Case #{c.caseNumber}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="font-mono uppercase font-semibold text-amber-300">
                        /{c.action}
                        {c.duration ? ` (${c.duration})` : ''}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-200 font-medium">
                        Target: {c.targetName}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span
                        className={`font-mono uppercase text-[11px] ${
                          c.status === 'active'
                            ? 'text-emerald-400'
                            : c.status === 'resolved'
                            ? 'text-slate-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{c.reason}</p>
                    <div className="text-[11px] text-slate-500">
                      Issued by {c.moderatorName} ·{' '}
                      {new Date(c.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  {c.status === 'active' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCaseStatus(c.id, 'resolved')}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-emerald-700 text-slate-200 hover:text-white text-xs rounded-md transition-colors whitespace-nowrap"
                      >
                        Resolve Case
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCaseStatus(c.id, 'revoked')}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-rose-700 text-slate-300 hover:text-white text-xs rounded-md transition-colors whitespace-nowrap"
                      >
                        Revoke
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Role-Based Access Control (RBAC) Permission Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Role-Based Permissions (RBAC) Matrix
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure granular command access, XP multipliers, and daily bonuses per role
                </p>
              </div>

              <select
                aria-label="Select role to edit permissions"
                value={selectedRoleForRbac.id}
                onChange={(e) => setSelectedRoleIdForRbac(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100"
              >
                {state.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (Hierarchy {r.hierarchy})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs">
              <div>
                <span className="text-slate-400 block">Role XP Multiplier</span>
                <span className="font-mono font-semibold text-indigo-300 text-sm">
                  {selectedRoleForRbac.xpMultiplier}x XP Gain
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Daily Stipend Bonus</span>
                <span className="font-mono font-semibold text-emerald-400 text-sm">
                  +{selectedRoleForRbac.dailyBonus.toLocaleString()} ◈ / day
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ALL_PERMISSIONS.map((perm) => {
                const granted = selectedRoleForRbac.permissions.includes(
                  perm.key
                );
                return (
                  <button
                    key={perm.key}
                    type="button"
                    onClick={() =>
                      togglePermissionOnRole(selectedRoleForRbac.id, perm.key)
                    }
                    className={`p-3 rounded-lg border text-left transition-colors flex items-center justify-between gap-2 ${
                      granted
                        ? 'bg-indigo-950/40 border-indigo-500/50 text-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-medium">{perm.label}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {perm.key}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-mono font-semibold ${
                        granted ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {granted ? 'ALLOW' : 'DENY'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
