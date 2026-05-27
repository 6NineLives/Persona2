'use client';

import { useEffect, useRef, useState } from 'react';

type CameraPreviewProps = {
  /** If provided, uses this stream instead of requesting camera */
  stream?: MediaStream | null;
  /** When true and no stream, calls getUserMedia */
  enabled?: boolean;
  className?: string;
};

export function CameraPreview({
  stream,
  enabled = true,
  className = '',
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const activeStream = stream ?? localStream;

  useEffect(() => {
    if (stream || !enabled) return;

    let cancelled = false;
    let acquired: MediaStream | null = null;

    (async () => {
      try {
        acquired = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          acquired.getTracks().forEach((t) => t.stop());
          return;
        }
        setLocalStream(acquired);
        setError(null);
      } catch (err) {
        console.error('[CameraPreview] getUserMedia failed:', err);
        if (!cancelled) {
          setError('Camera unavailable');
        }
      }
    })();

    return () => {
      cancelled = true;
      acquired?.getTracks().forEach((t) => t.stop());
    };
  }, [stream, enabled]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeStream) return;

    video.srcObject = activeStream;
    void video.play().catch(() => {
      /* autoplay policy */
    });

    return () => {
      video.srcObject = null;
    };
  }, [activeStream]);

  if (!enabled) return null;

  return (
    <div
      className={`absolute bottom-4 right-4 z-20 w-48 overflow-hidden rounded-lg border-2 border-primary shadow-lg ${className}`}
    >
      <div className="relative aspect-[4/3] w-full bg-black">
        {error ? (
          <div className="flex h-full items-center justify-center p-2 text-center text-[10px] text-muted-foreground">
            {error}
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
            aria-label="Your camera preview"
          />
        )}
      </div>
    </div>
  );
}
