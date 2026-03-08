import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { MessageCircle, Copy, Check, Loader2, FileText, Terminal } from 'lucide-react';
import type { TranslationResult } from '@/services/gemini';
import { cn } from '@/lib/utils';

interface TranslationPanelProps {
  result: TranslationResult | null;
  isLoading: boolean;
  loadingStatus?: string;
  className?: string;
}

export function TranslationPanel({ result, isLoading, loadingStatus, className }: TranslationPanelProps) {

  const [copied, setCopied] = React.useState(false);

  const fullText = useMemo(() => {

    if (!result) return '';

    return result.items
      .map(item => {
        const speaker = item.speaker ? `[${item.speaker}] ` : '';
        return `${speaker}${item.translatedText}`;
      })
      .join('\n\n');

  }, [result]);

  const handleCopyAll = () => {

    if (!fullText) return;

    navigator.clipboard.writeText(fullText);

    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {

    return (
      <div className={cn("flex flex-col items-center justify-center gap-6 p-6 w-full h-full bg-zinc-900", className)}>

        <div className="relative">

          <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />

          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin relative z-10" />

        </div>

        <div className="space-y-2 text-center">

          <div className="text-sm font-mono text-indigo-400 animate-pulse">
            {loadingStatus || "ANALYZING EVIDENCE..."}
          </div>

          <div className="text-xs text-zinc-500 font-mono">
            DETECTING TEXT & CONTEXT
          </div>

        </div>

      </div>
    );
  }

  if (!result) {

    return (
      <div className={cn("flex flex-col items-center justify-center p-6 text-zinc-600 h-full min-h-[300px]", className)}>

        <Terminal className="w-12 h-12 mb-4 opacity-20" />

        <p className="text-sm font-mono uppercase tracking-wider">
          Awaiting Input Data
        </p>

      </div>
    );
  }

  return (

    <div className={cn("flex flex-col h-full overflow-hidden bg-zinc-900", className)}>

      <div className="p-4 border-b border-zinc-800 bg-zinc-900 sticky top-0 z-10 flex justify-between items-center gap-4">

        <div className="flex items-center gap-2">

          <FileText className="w-4 h-4 text-emerald-500" />

          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
            Translation Report
          </h2>

        </div>

        <button
          onClick={handleCopyAll}
          className="group flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-medium text-zinc-300 transition-colors border border-zinc-700"
          title="Copy Report"
        >

          {copied
            ? <Check className="w-3.5 h-3.5 text-emerald-400" />
            : <Copy className="w-3.5 h-3.5 group-hover:text-white" />
          }

          <span>{copied ? "COPIED" : "COPY"}</span>

        </button>

      </div>

      <div className="flex-1 overflow-y-auto p-0 custom-scrollbar relative">

        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:100%_2rem]" />

        <textarea
          readOnly
          value={fullText}
          className="w-full h-full bg-transparent border-none resize-none text-zinc-300 font-sans leading-relaxed focus:ring-0 p-6 text-base"
          style={{ minHeight: '300px' }}
        />

      </div>

      <div className="h-8 border-t border-zinc-800 bg-zinc-950 flex items-center px-4 justify-between text-[10px] font-mono text-zinc-600 uppercase">

        <span>Lines: {result.items.length}</span>

        <span>Status: COMPLETE</span>

      </div>

    </div>
  );
}