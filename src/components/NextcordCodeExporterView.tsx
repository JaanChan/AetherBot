import React, { useState } from 'react';
import { BotDatabaseState } from '../types/bot';
import { generateNextcordFiles } from '../utils/nextcordCodeGenerator';
import { Code2, Copy, Check, Download, FileCode } from 'lucide-react';

interface NextcordCodeExporterViewProps {
  state: BotDatabaseState;
}

export const NextcordCodeExporterView: React.FC<
  NextcordCodeExporterViewProps
> = ({ state }) => {
  const files = generateNextcordFiles(state);
  const [selectedPath, setSelectedPath] = useState<string>(files[0].path);
  const [copied, setCopied] = useState<boolean>(false);

  const activeFile =
    files.find((f) => f.path === selectedPath) || files[0];

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleDownloadCurrentFile = () => {
    const blob = new Blob([activeFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Production Nextcord Python 3.11+ Source Code (nextcord + aiosqlite)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Dynamically reflects your configured shop items ({state.shopItems.length}), welcome templates ({state.welcome.channelName}), and leveling curve ({state.leveling.xpPerMessageMin}–{state.leveling.xpPerMessageMax} XP/msg)
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied {activeFile.filename}
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy {activeFile.filename}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownloadCurrentFile}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Download {activeFile.filename}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Project Tree (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="text-xs font-semibold text-slate-400 pb-2 border-b border-slate-800">
            Nextcord Multi-Cog Architecture
          </div>
          {files.map((file) => {
            const isSelected = file.path === activeFile.path;
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedPath(file.path)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? 'bg-indigo-950/50 border-indigo-500/60 text-slate-100'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-950'
                }`}
              >
                <div className="flex items-center justify-between font-mono text-xs font-semibold">
                  <span className="text-indigo-300">{file.path}</span>
                  <FileCode className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  {file.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Right: Code Viewer (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300">
            <span>{activeFile.path}</span>
            <span className="text-slate-500">
              {activeFile.code.split('\n').length} lines · UTF-8
            </span>
          </div>
          <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[620px] overflow-y-auto">
            <code>{activeFile.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
