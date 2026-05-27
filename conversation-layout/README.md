# Conversation layout (portable)

Copy this entire folder into another project. It matches the AgoraAda in-call layout:

- **Left:** transcript / conversation sidebar
- **Center:** AI agent visualizer (pulsing orb)
- **Bottom-right:** your camera preview
- **Bottom:** mic / camera controls
- **Top:** header with End Conversation

## Requirements

- React 18+
- Tailwind CSS with theme tokens: `background`, `foreground`, `border`, `card`, `primary`, `destructive`, `muted-foreground`

If your project does not use the Agora quickstart theme, add minimal CSS variables (see `theme-snippet.css`).

## Quick start

```tsx
import { ConversationScreen } from './conversation-layout';

export default function CallPage() {
  return (
    <div className="flex h-dvh flex-col">
      <ConversationScreen
        title="My Voice Agent"
        agentName="Ada"
        agentUID="123456"
        visualizerState="listening"
        messageList={[
          { uid: '123456', text: 'Kumusta! How can I help?', createdAt: Date.now() },
          { uid: 999, text: 'Hello!', createdAt: Date.now() },
        ]}
        onEndConversation={() => console.log('end')}
        onMicToggle={() => console.log('mic')}
      />
    </div>
  );
}
```

## With your own camera stream (e.g. Agora RTC)

```tsx
<ConversationScreen
  cameraStream={localCameraTrack?.getMediaStreamTrack?.()
    ? new MediaStream([localCameraTrack.getMediaStreamTrack()])
    : undefined}
  showCamera
/>
```

## Compose pieces individually

```tsx
import {
  ConversationLayoutHeader,
  TranscriptSidebar,
  AgentVisualizerStage,
  CameraPreview,
} from './conversation-layout';

<AgentVisualizerStage state="speaking" agentName="Ada">
  <CameraPreview />
</AgentVisualizerStage>
```

## File map

| File | Role |
|------|------|
| `ConversationScreen.tsx` | Full page layout (use this first) |
| `TranscriptSidebar.tsx` | Left conversation panel |
| `AgentVisualizerStage.tsx` | Center AI orb + slot for camera |
| `CameraPreview.tsx` | Bottom-right webcam tile |
| `ConversationControls.tsx` | Mic / Cam pill dock |
| `ConversationLayoutHeader.tsx` | Top bar |
| `types.ts` | Shared TypeScript types |
| `index.ts` | Barrel exports |

## Wiring Agora (optional)

In AgoraAda, the live version uses `QuickstartConversationLayout` + `ConversationComponent` with `agora-rtc-react` and `agora-agent-uikit`. This export is **UI-only** so you can plug in any RTC/AI backend.

Replace mock `messageList` with transcript state from your toolkit, and pass `visualizerState` from agent state events.
