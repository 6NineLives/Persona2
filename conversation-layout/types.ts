import type { ReactNode } from 'react';

export type TranscriptMessage = {
  turn_id?: string | number;
  uid: number | string;
  text?: string;
  createdAt?: number;
};

export type AgentVisualizerState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'disconnected';

export type ConversationScreenProps = {
  /** Completed transcript turns */
  messageList?: TranscriptMessage[];
  /** Live partial turn (optional) */
  currentInProgressMessage?: TranscriptMessage | null;
  /** UID string used to label agent vs user bubbles */
  agentUID?: string;
  /** Center visualizer animation state */
  visualizerState?: AgentVisualizerState;
  /** Agent display name inside the orb */
  agentName?: string;
  /** Header title */
  title?: string;
  /** Header subtitle */
  subtitle?: string;
  /** Logo image URL (optional) */
  logoSrc?: string;
  /** Show camera preview tile */
  showCamera?: boolean;
  /** External MediaStream for camera (if omitted, requests getUserMedia) */
  cameraStream?: MediaStream | null;
  /** Mic enabled state */
  isMicEnabled?: boolean;
  /** Called when mic button clicked */
  onMicToggle?: () => void;
  /** Called when End Conversation clicked */
  onEndConversation?: () => void;
  /** Slot above transcript list */
  headerExtra?: ReactNode;
  /** Slot in header row (e.g. connection status) */
  statusSlot?: ReactNode;
  /** Slot below title in header (e.g. pipeline metrics) */
  metricsSlot?: ReactNode;
  /** Custom controls dock; defaults to mic button */
  controlsSlot?: ReactNode;
  className?: string;
};
