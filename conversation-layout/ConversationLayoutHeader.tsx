'use client';

import type { ReactNode } from 'react';

type ConversationLayoutHeaderProps = {
  title: string;
  subtitle?: string;
  logoSrc?: string;
  metricsSlot?: ReactNode;
  statusSlot?: ReactNode;
  onEndConversation?: () => void;
};

export function ConversationLayoutHeader({
  title,
  subtitle,
  logoSrc,
  metricsSlot,
  statusSlot,
  onEndConversation,
}: ConversationLayoutHeaderProps) {
  return (
    <header className="flex shrink-0 flex-col gap-4 border-b border-border px-4 py-4 md:h-[76px] md:flex-row md:items-center md:justify-between md:px-6 md:py-0">
      <div className="flex min-w-0 items-center gap-3">
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt=""
            className="h-10 w-10 shrink-0 object-contain"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary">
            AI
          </div>
        )}
        <div className="flex min-w-0 flex-col justify-center gap-1">
          <span className="truncate text-lg font-semibold leading-none tracking-[-0.025em] text-foreground">
            {title}
          </span>
          {subtitle && (
            <span className="truncate text-xs text-muted-foreground">
              {subtitle}
            </span>
          )}
          {metricsSlot}
        </div>
      </div>

      <div className="flex items-center gap-2 md:pr-1">
        {statusSlot}
        {onEndConversation && (
          <button
            type="button"
            onClick={onEndConversation}
            className="h-8 rounded-md border border-destructive bg-transparent px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            aria-label="End conversation with AI agent"
          >
            End Conversation
          </button>
        )}
      </div>
    </header>
  );
}
