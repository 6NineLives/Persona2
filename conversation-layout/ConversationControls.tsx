'use client';

import type { ReactNode } from 'react';

type ConversationControlsProps = {
  isMicEnabled?: boolean;
  onMicToggle?: () => void;
  onCameraToggle?: () => void;
  isCameraEnabled?: boolean;
  children?: ReactNode;
};

export function ConversationControls({
  isMicEnabled = true,
  onMicToggle,
  onCameraToggle,
  isCameraEnabled = true,
  children,
}: ConversationControlsProps) {
  return (
    <div
      className="mx-auto flex w-fit items-center gap-3 rounded-full border border-border bg-card/80 px-4 py-2 backdrop-blur-md"
      role="group"
      aria-label="Audio and video controls"
    >
      <button
        type="button"
        onClick={onMicToggle}
        className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
          isMicEnabled
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
        }`}
        aria-label={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
        aria-pressed={isMicEnabled}
      >
        Mic
      </button>

      {onCameraToggle && (
        <button
          type="button"
          onClick={onCameraToggle}
          className={`flex h-10 w-10 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
            isCameraEnabled
              ? 'border-primary text-primary hover:bg-primary/10'
              : 'border-border text-muted-foreground hover:bg-muted'
          }`}
          aria-label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
          aria-pressed={isCameraEnabled}
        >
          Cam
        </button>
      )}

      {children}
    </div>
  );
}
