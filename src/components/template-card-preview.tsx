'use client';

import { useState, useRef } from 'react';
import { Film, Play, Volume2, VolumeX } from 'lucide-react';

interface TemplateCardPreviewProps {
  previewVideoUrl: string | null;
}

export function TemplateCardPreview({ previewVideoUrl }: TemplateCardPreviewProps) {
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  function toggleMute(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !muted;
    if (videoRef.current) {
      videoRef.current.muted = next;
      if (!next) videoRef.current.play().catch(() => {});
    }
    setMuted(next);
  }

  return (
    <div className="group relative aspect-[9/16] max-h-80 bg-zinc-100 overflow-hidden border border-zinc-200">
      {previewVideoUrl ? (
        <>
          <video
            ref={videoRef}
            src={previewVideoUrl}
            className="h-full w-full object-cover"
            muted={muted}
            loop
            playsInline
            preload="metadata"
            onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
            onMouseOut={(e) => {
              const v = e.target as HTMLVideoElement;
              v.pause();
              v.currentTime = 0;
            }}
          />
          <button
            onClick={toggleMute}
            className="absolute bottom-2 right-2 z-10 p-1.5 rounded bg-orange-500/90 text-white hover:bg-orange-500 transition-colors"
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </>
      ) : (
        <div className="flex items-center justify-center h-full">
          <Film className="h-12 w-12 text-orange-500/50" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
        <Play className="h-10 w-10 text-white/80" />
      </div>
    </div>
  );
}
