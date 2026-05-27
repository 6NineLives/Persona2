'use client';

import type { ReactNode } from 'react';
import type { AgentVisualizerState } from './types';

type AgentVisualizerStageProps = {
  state?: AgentVisualizerState;
  agentName?: string;
  children?: ReactNode;
};

const STATE_LABELS: Record<AgentVisualizerState, string> = {
  idle: 'Ready',
  connecting: 'Connecting…',
  listening: 'Listening',
  thinking: 'Thinking…',
  speaking: 'Speaking',
  disconnected: 'Disconnected',
};

export function AgentVisualizerStage({
  state = 'idle',
  agentName = 'AI',
  children,
}: AgentVisualizerStageProps) {
  const isActive = state === 'listening' || state === 'speaking' || state === 'thinking';
  const isSpeaking = state === 'speaking';

  return (
    <div
      className="relative flex h-full min-h-[20rem] w-full max-w-4xl items-center justify-center"
      role="region"
      aria-label="AI agent status visualization"
    >
      {/* Pulsing rings */}
      <div
        className={`absolute h-56 w-56 rounded-full border border-primary/30 transition-opacity duration-500 ${
          isActive ? 'opacity-100 animate-pulse' : 'opacity-40'
        }`}
        aria-hidden
      />
      <div
        className={`absolute h-44 w-44 rounded-full border border-primary/40 transition-all duration-500 ${
          isSpeaking ? 'scale-110 opacity-100' : 'scale-100 opacity-60'
        }`}
        aria-hidden
      />
      <div
        className={`absolute h-32 w-32 rounded-full bg-primary/10 blur-xl transition-all duration-300 ${
          isSpeaking ? 'scale-125 bg-primary/25' : ''
        }`}
        aria-hidden
      />

      {/* Core orb */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div
          className={`flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_40px_hsl(var(--primary)/0.45)] transition-transform duration-300 ${
            isSpeaking ? 'scale-105' : ''
          }`}
        >
          <span className="text-lg font-semibold tracking-tight">{agentName}</span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {STATE_LABELS[state]}
        </span>
      </div>

      {/* Camera preview slot (bottom-right) */}
      {children}
    </div>
  );
}
