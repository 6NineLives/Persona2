'use client';

import { useState } from 'react';
import { AgentVisualizerStage } from './AgentVisualizerStage';
import { CameraPreview } from './CameraPreview';
import { ConversationControls } from './ConversationControls';
import { ConversationLayoutHeader } from './ConversationLayoutHeader';
import { TranscriptSidebar } from './TranscriptSidebar';
import type { ConversationScreenProps } from './types';

/**
 * Main in-call layout: transcript sidebar (left), AI visualizer (center),
 * camera preview (bottom-right), controls dock (bottom).
 *
 * Copy the entire `export/conversation-layout` folder into your project.
 */
export function ConversationScreen({
  messageList = [],
  currentInProgressMessage = null,
  agentUID = '123456',
  visualizerState = 'idle',
  agentName = 'Ada',
  title = 'Voice AI Conversation',
  subtitle,
  logoSrc,
  showCamera = true,
  cameraStream,
  isMicEnabled = true,
  onMicToggle,
  onEndConversation,
  headerExtra,
  statusSlot,
  metricsSlot,
  controlsSlot,
  className = '',
}: ConversationScreenProps) {
  const [isCameraOn, setIsCameraOn] = useState(showCamera);

  const handleCameraToggle = () => {
    setIsCameraOn((on) => !on);
  };

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col bg-background text-foreground ${className}`}
    >
      <ConversationLayoutHeader
        title={title}
        subtitle={subtitle}
        logoSrc={logoSrc}
        metricsSlot={metricsSlot}
        statusSlot={statusSlot}
        onEndConversation={onEndConversation}
      />

      <div className="flex min-h-0 w-full flex-1 flex-col gap-4 px-4 pb-4 pt-4 md:px-6 lg:flex-row lg:gap-0">
        {/* Left: transcript sidebar */}
        <aside className="order-2 h-64 min-h-0 w-full shrink-0 lg:order-1 lg:h-full lg:w-[26rem]">
          {headerExtra}
          <TranscriptSidebar
            messageList={messageList}
            currentInProgressMessage={currentInProgressMessage}
            agentUID={agentUID}
          />
        </aside>

        {/* Right: visualizer + camera + controls */}
        <main className="order-1 flex min-h-0 flex-1 flex-col lg:order-2 lg:border-l lg:border-border/80 lg:pl-6">
          <div className="flex min-h-0 flex-1 flex-col pb-2 pt-3 md:pb-6">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <AgentVisualizerStage state={visualizerState} agentName={agentName}>
                {isCameraOn && (
                  <CameraPreview stream={cameraStream} enabled={isCameraOn} />
                )}
              </AgentVisualizerStage>
            </div>

            <div className="shrink-0 pt-4">
              {controlsSlot ?? (
                <ConversationControls
                  isMicEnabled={isMicEnabled}
                  onMicToggle={onMicToggle}
                  isCameraEnabled={isCameraOn}
                  onCameraToggle={handleCameraToggle}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
