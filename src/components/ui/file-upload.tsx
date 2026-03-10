'use client';

import { useCallback, useState, type ChangeEvent } from 'react';
import { Upload, X, FileVideo, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  accept: string;
  label?: string;
  onChange: (file: File | null) => void;
  value?: File | null;
  type?: 'video' | 'image';
}

export function FileUpload({ accept, label, onChange, value, type = 'image' }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onChange(file);
    },
    [onChange]
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onChange(file);
  };

  const Icon = type === 'video' ? FileVideo : ImageIcon;

  return (
    <div className="space-y-1.5">
      {label && <p className="text-sm font-medium text-zinc-300">{label}</p>}
      {value ? (
        <div className="flex items-center gap-3 rounded border border-zinc-300 bg-white px-4 py-3">
          <Icon className="h-5 w-5 text-orange-500 shrink-0" />
          <span className="text-sm text-zinc-800 truncate flex-1">{value.name}</span>
          <button onClick={() => onChange(null)} className="text-zinc-500 hover:text-red-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'relative flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed px-4 py-8 transition-colors cursor-pointer',
            dragOver ? 'border-orange-500 bg-orange-50' : 'border-zinc-300 hover:border-orange-500/50 bg-zinc-50'
          )}
        >
          <Upload className="h-8 w-8 text-orange-500/70" />
          <p className="text-sm text-zinc-400">
            Drop file here or <span className="text-orange-500">browse</span>
          </p>
          <input
            type="file"
            accept={accept}
            onChange={handleChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}
