'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Type, Film, ImageIcon, Volume2, VolumeX } from 'lucide-react';
import type { SceneElement } from '@/types';

interface SceneCanvasProps {
  elements: SceneElement[];
  backgroundVideo?: string;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  onUpdateElement: (index: number, updates: Partial<SceneElement>) => void;
  /** Per-element live text values keyed by element index */
  liveText?: Record<number, string>;
  /** Per-element uploaded file URLs keyed by element index */
  liveMedia?: Record<number, string>;
  /** When true, non-editable elements cannot be dragged or resized */
  readonly?: boolean;
}

const ELEMENT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  text:  { bg: 'rgba(249,115,22,0.15)', border: 'rgb(249,115,22)',  text: '#fff' },
  video: { bg: 'rgba(59,130,246,0.15)', border: 'rgb(59,130,246)',  text: '#93c5fd' },
  image: { bg: 'rgba(34,197,94,0.15)',  border: 'rgb(34,197,94)',   text: '#86efac' },
};

const SIZE_DEFAULTS: Record<string, { w: number; h: number }> = {
  text: { w: 80, h: 8 }, video: { w: 50, h: 30 }, image: { w: 25, h: 15 },
};

function getIcon(type: string) {
  if (type === 'text') return <Type className="h-3 w-3 shrink-0" />;
  if (type === 'image') return <ImageIcon className="h-3 w-3 shrink-0" />;
  return <Film className="h-3 w-3 shrink-0" />;
}

export function SceneCanvas({
  elements, backgroundVideo, selectedIndex, onSelect, onUpdateElement,
  liveText, liveMedia, readonly,
}: SceneCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [dragging, setDragging] = useState<{ idx: number; startX: number; startY: number; elX: number; elY: number } | null>(null);
  const [resizing, setResizing] = useState<{ idx: number; startX: number; startY: number; elW: number; elH: number } | null>(null);

  const getCanvasRect = useCallback(() => canvasRef.current?.getBoundingClientRect() ?? null, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = getCanvasRect();
    if (!rect) return;
    if (dragging) {
      const dx = ((e.clientX - dragging.startX) / rect.width) * 100;
      const dy = ((e.clientY - dragging.startY) / rect.height) * 100;
      const newX = Math.max(0, Math.min(100 - (elements[dragging.idx]?.width ?? 30), dragging.elX + dx));
      const newY = Math.max(0, Math.min(100 - (elements[dragging.idx]?.height ?? 15), dragging.elY + dy));
      onUpdateElement(dragging.idx, { x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 });
    }
    if (resizing) {
      const dx = ((e.clientX - resizing.startX) / rect.width) * 100;
      const dy = ((e.clientY - resizing.startY) / rect.height) * 100;
      const newW = Math.max(10, Math.min(100, resizing.elW + dx));
      const newH = Math.max(5, Math.min(100, resizing.elH + dy));
      onUpdateElement(resizing.idx, { width: Math.round(newW * 10) / 10, height: Math.round(newH * 10) / 10 });
    }
  }, [dragging, resizing, getCanvasRect, onUpdateElement, elements]);

  const handleMouseUp = useCallback(() => { setDragging(null); setResizing(null); }, []);

  useEffect(() => {
    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }
  }, [dragging, resizing, handleMouseMove, handleMouseUp]);

  function canInteract(el: SceneElement) {
    if (!readonly) return true;
    return el.editable;
  }

  function startDrag(e: React.MouseEvent, idx: number) {
    if (!canInteract(elements[idx])) return;
    e.stopPropagation();
    const el = elements[idx];
    setDragging({ idx, startX: e.clientX, startY: e.clientY, elX: el.x ?? 0, elY: el.y ?? 0 });
    onSelect(idx);
  }

  function startResize(e: React.MouseEvent, idx: number) {
    if (!canInteract(elements[idx])) return;
    e.stopPropagation();
    e.preventDefault();
    const el = elements[idx];
    setResizing({ idx, startX: e.clientX, startY: e.clientY, elW: el.width ?? 30, elH: el.height ?? 15 });
  }

  return (
    <div
      ref={canvasRef}
      className="relative rounded-lg overflow-hidden select-none w-full mx-auto"
      style={{ background: '#111', aspectRatio: '9/16' }}
      onClick={() => onSelect(null)}
    >
      {backgroundVideo && (
        <video src={backgroundVideo} className="absolute inset-0 w-full h-full object-cover opacity-40" muted={muted} loop autoPlay playsInline />
      )}
      {!backgroundVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-zinc-600 text-xs">9:16 Canvas</span>
        </div>
      )}
      <div className="absolute inset-0" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '10% 10%',
      }} />
      {(backgroundVideo || elements.some((el, i) => el.type === 'video' && (liveMedia?.[i] ?? el.src))) && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
          className="absolute top-2 right-2 z-30 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}

      {elements.map((el, i) => {
        const d = SIZE_DEFAULTS[el.type] || SIZE_DEFAULTS.text;
        const x = el.x ?? ((100 - d.w) / 2);
        const y = el.y ?? (10 + i * 18);
        const w = el.width ?? d.w;
        const h = el.height ?? d.h;
        const colors = ELEMENT_COLORS[el.type] || ELEMENT_COLORS.text;
        const selected = selectedIndex === i;
        const interactive = canInteract(el);
        const mediaUrl = liveMedia?.[i] || el.src;
        const textVal = liveText?.[i] ?? el.default_value ?? '';

        const elStyle: React.CSSProperties = {
          left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`,
          backgroundColor: colors.bg,
          border: `${selected ? 2 : 1}px solid ${selected ? colors.border : 'rgba(255,255,255,0.2)'}`,
          borderRadius: el.borderRadius ?? 4,
          color: colors.text,
          zIndex: selected ? 20 : 10,
          boxShadow: selected ? `0 0 0 1px ${colors.border}, 0 4px 12px rgba(0,0,0,0.3)` : 'none',
          opacity: el.opacity != null ? el.opacity : 1,
          cursor: interactive ? 'move' : 'default',
          overflow: 'hidden',
        };

        return (
          <div
            key={i}
            className="absolute flex flex-col items-center justify-center transition-shadow"
            style={elStyle}
            onMouseDown={(e) => startDrag(e, i)}
          >
            {/* Image thumbnail */}
            {el.type === 'image' && mediaUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={mediaUrl} alt={el.label} draggable={false}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ objectFit: el.objectFit || 'cover', borderRadius: el.borderRadius ?? 4 }}
              />
            )}

            {/* Video thumbnail */}
            {el.type === 'video' && mediaUrl && (
              <video
                src={mediaUrl} muted={muted} playsInline loop autoPlay draggable={false}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ objectFit: el.objectFit || 'cover', borderRadius: el.borderRadius ?? 4 }}
              />
            )}

            {/* Text element: render styled text */}
            {el.type === 'text' && textVal ? (
              <span
                className="px-1 text-center w-full whitespace-pre-wrap break-words overflow-hidden leading-tight"
                style={{
                  fontFamily: el.fontFamily || 'Arial',
                  fontWeight: el.fontWeight || 'bold',
                  fontSize: `clamp(6px, ${(el.fontSize || 24) * 0.35}px, ${h * 1.5}px)`,
                  color: el.fontColor || '#ffffff',
                  textShadow: el.dropShadow
                    ? `${el.shadowX ?? 2}px ${el.shadowY ?? 2}px 2px ${el.shadowColor || '#000'}`
                    : 'none',
                  display: '-webkit-box',
                  WebkitLineClamp: 10,
                  WebkitBoxOrient: 'vertical' as const,
                }}
              >
                {textVal}
              </span>
            ) : (
              <div className="flex items-center gap-1" style={{ fontSize: '10px' }}>
                {getIcon(el.type)}
                <span className="truncate px-1 font-medium">{el.label || el.type}</span>
              </div>
            )}

            {!interactive && (
              <div className="absolute inset-0 rounded" style={{ background: 'rgba(0,0,0,0.15)' }} />
            )}

            {selected && interactive && (
              <div
                className="absolute -right-1 -bottom-1 w-3 h-3 rounded-sm cursor-se-resize"
                style={{ backgroundColor: colors.border }}
                onMouseDown={(e) => startResize(e, i)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
