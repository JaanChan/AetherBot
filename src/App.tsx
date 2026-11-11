import React, { useEffect, useState, useCallback } from 'react';
import { BotDatabaseState } from './types/bot';
import { createInitialBotState } from './utils/botEngine';
import { CommandSandboxView } from './components/CommandSandboxView';
import { EconomyShopView } from './components/EconomyShopView';
import { LevelingLeaderboardView } from './components/LevelingLeaderboardView';
import { ModerationRbacView } from './components/ModerationRbacView';
import { WelcomeAnalyticsView } from './components/WelcomeAnalyticsView';
import { NextcordCodeExporterView } from './components/NextcordCodeExporterView';
import { RotateCcw } from 'lucide-react';

type ActiveSection =
  | 'sandbox'
  | 'economy'
  | 'leveling'
  | 'moderation'
  | 'welcome'
  | 'code';

const LOCAL_STORAGE_KEY = 'aetherbot_persistent_state_v1';

export default function App() {
  const [botState, setBotState] = useState<BotDatabaseState>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as BotDatabaseState;
        if (parsed && Array.isArray(parsed.members) && Array.isArray(parsed.roles)) {
          return parsed;
        }
      }
    } catch {
      // Fallback to seed state
    }
    return createInitialBotState();
  });

  const [activeSection, setActiveSection] = useState<ActiveSection>('sandbox');
  const [dbSyncedAt, setDbSyncedAt] = useState<string>('Synced');

  // Load initial persistent state from backend API if no local modifications yet
  useEffect(() => {
    const hasLocal = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (hasLocal) return;

    fetch('/api/bot-state')
      .then((res) => (res.ok ? res.json() : null))
      .then((serverData: BotDatabaseState | null) => {
        if (
          serverData &&
          Array.isArray(serverData.members) &&
          Array.isArray(serverData.roles)
        ) {
          setBotState(serverData);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serverData));
        }
      })
      .catch(() => {
        // Offline / localStorage fallback remains active
      });
  }, []);

  const handleUpdateState = useCallback(
    (updater: (prev: BotDatabaseState) => BotDatabaseState) => {
      setBotState((prev) => {
        const next = updater(prev);
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore quota errors
        }
        fetch('/api/bot-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        })
          .then(() => {
            setDbSyncedAt(
              new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
            );
          })
          .catch(() => {
            // Persisted in localStorage
          });
        return next;
      });
    },
    []
  );

  const handleResetDatabase = () => {
    const fresh = createInitialBotState();
    setBotState(fresh);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // Ignore
    }
    fetch('/api/bot-state/reset', { method: 'POST' }).catch(() => {});
    setDbSyncedAt('Reset to default');
  };

  const navItems: { id: ActiveSection; label: string }[] = [
    { id: 'sandbox', label: 'Command Sandbox' },
    { id: 'economy', label: 'Economy & Shop' },
    { id: 'leveling', label: 'Leveling & Ranks' },
    { id: 'moderation', label: 'Moderation & RBAC' },
    { id: 'welcome', label: 'Welcome & Analytics' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-slate-950">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#sandbox"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('sandbox');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 font-display"
        >
          AetherBot
        </a>

        {/* Zone 2: 5 clean single-line text navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400"
        >
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                setActiveSection(item.id);
              }}
              className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
                activeSection === item.id
                  ? 'text-white border-b-2 border-indigo-500'
                  : 'hover:text-slate-100'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSection('code')}
            className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors whitespace-nowrap shrink-0"
          >
            Nextcord Python Code
          </button>
        </div>
      </header>

      {/* Mobile Navigation Bar (Visible on small viewports) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden flex items-center gap-2 overflow-x-auto px-4 py-2.5 bg-slate-900 border-b border-slate-800"
      >
        {[...navItems, { id: 'code' as ActiveSection, label: 'Python Code' }].map(
          (item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                activeSection === item.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          )
        )}
      </nav>

      {/* Workspace Context Bar below Header */}
      <div className="border-b border-slate-900 bg-slate-900/40 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-200">
              Guild: {botState.guildName}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">Nextcord v2.6 Slash Engine</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              SQLite / JSON Persistence: {dbSyncedAt}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetDatabase}
              className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Demo Database
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeSection === 'sandbox' && (
          <CommandSandboxView
            state={botState}
            onUpdateState={handleUpdateState}
          />
        )}
        {activeSection === 'economy' && (
          <EconomyShopView
            state={botState}
            onUpdateState={handleUpdateState}
          />
        )}
        {activeSection === 'leveling' && (
          <LevelingLeaderboardView
            state={botState}
            onUpdateState={handleUpdateState}
          />
        )}
        {activeSection === 'moderation' && (
          <ModerationRbacView
            state={botState}
            onUpdateState={handleUpdateState}
          />
        )}
        {activeSection === 'welcome' && (
          <WelcomeAnalyticsView
            state={botState}
            onUpdateState={handleUpdateState}
          />
        )}
        {activeSection === 'code' && (
          <NextcordCodeExporterView state={botState} />
        )}
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-slate-900 px-6 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            AetherBot Nextcord Suite · Built for Discord Application Slash Commands & Persistent SQLite
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveSection('sandbox')}
              className="hover:text-slate-300 transition-colors"
            >
              Command Sandbox
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('code')}
              className="hover:text-slate-300 transition-colors"
            >
              Export Python Bot
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
