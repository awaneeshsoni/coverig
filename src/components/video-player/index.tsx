'use client';

import { useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  aspectRatio?: 'video' | 'portrait';
}

export function VideoPlayer({ src, poster, className, aspectRatio = 'video' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function toggleFullscreen() {
    videoRef.current?.requestFullscreen?.();
  }

  const aspect = aspectRatio === 'portrait' ? 'aspect-[9/16]' : 'aspect-video';

  return (
    <div className={cn('group relative rounded-xl overflow-hidden bg-zinc-100', aspect, className)}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted={muted}
        playsInline
        loop
        className="h-full w-full object-cover"
        onClick={togglePlay}
      />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={togglePlay}
          className="rounded-full bg-black/50 p-3 text-white backdrop-blur-sm hover:bg-black/70 transition-colors"
        >
          {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </button>
      </div>
      <div className="absolute bottom-0 inset-x-0 flex items-center gap-2 p-3 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/50 to-transparent">
        <button onClick={toggleMute} className="text-white/80 hover:text-white transition-colors">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <div className="flex-1" />
        <button onClick={toggleFullscreen} className="text-white/80 hover:text-white transition-colors">
          <Maximize className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
