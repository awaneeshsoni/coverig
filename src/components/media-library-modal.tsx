'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Upload, Film, ImageIcon, Loader2, FolderOpen, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MediaAsset, MediaCategory } from '@/types';
import { MEDIA_CATEGORIES } from '@/types';

interface MediaLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  accept?: 'video' | 'image' | 'all';
}

const TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Videos' },
  { value: 'image', label: 'Images' },
] as const;

export function MediaLibraryModal({ open, onClose, onSelect, accept = 'all' }: MediaLibraryModalProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<MediaCategory | 'all'>('all');
  const [fileType, setFileType] = useState<'all' | 'video' | 'image'>(accept === 'all' ? 'all' : accept);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<MediaCategory>('other');
  const [libraryMuted, setLibraryMuted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const fetchAssets = useCallback(async (p: number, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '24' });
      if (fileType !== 'all') params.set('type', fileType);
      if (category !== 'all') params.set('category', category);
      if (search.trim()) params.set('q', search.trim());

      const res = await fetch(`/api/media-library?${params}`);
      const json = await res.json();
      if (res.ok) {
        setAssets((prev) => append ? [...prev, ...(json.data || [])] : (json.data || []));
        setTotal(json.total || 0);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [fileType, category, search]);

  useEffect(() => {
    if (!open) return;
    setPage(1);
    fetchAssets(1);
  }, [open, fileType, category, fetchAssets]);

  function handleSearch(val: string) {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchAssets(1);
    }, 400);
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    fetchAssets(next, true);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', uploadCategory);
      const res = await fetch('/api/media-library', { method: 'POST', body: formData });
      if (res.ok) {
        setPage(1);
        fetchAssets(1);
      }
    } catch { /* ignore */ } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  const hasMore = assets.length < total;
  const acceptAttr = accept === 'video' ? 'video/*' : accept === 'image' ? 'image/*' : 'video/*,image/*';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Content Library</h2>
            <span className="text-xs text-zinc-400">{total} assets</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLibraryMuted((m) => !m)}
              className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500"
              title={libraryMuted ? 'Unmute previews' : 'Mute previews'}
            >
              {libraryMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as MediaCategory)}
              className="text-xs border border-zinc-200 rounded px-2 py-1 bg-white">
              {MEDIA_CATEGORIES.filter((c) => c.value !== 'all').map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} loading={uploading}>
              <Upload className="h-3.5 w-3.5 mr-1.5" />Upload
            </Button>
            <input ref={fileInputRef} type="file" accept={acceptAttr} className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-zinc-50 space-y-3">
          <div className="flex items-center gap-4">
            {/* Category pills */}
            <div className="flex gap-1 flex-wrap flex-1">
              {MEDIA_CATEGORIES.map((c) => (
                <button key={c.value} onClick={() => setCategory(c.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    category === c.value
                      ? 'bg-orange-100 text-orange-700'
                      : 'text-zinc-500 hover:bg-zinc-100'
                  }`}
                >{c.label}</button>
              ))}
            </div>
            {/* Type toggle */}
            {accept === 'all' && (
              <div className="flex gap-0.5 bg-zinc-100 rounded-lg p-0.5">
                {TYPE_OPTIONS.map((t) => (
                  <button key={t.value} onClick={() => setFileType(t.value)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      fileType === t.value ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'
                    }`}
                  >{t.label}</button>
                ))}
              </div>
            )}
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input type="text" value={search} onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by filename or tag..."
              className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-lg text-sm bg-white placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && assets.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-400">
              <FolderOpen className="h-12 w-12 mb-3" />
              <p className="text-sm font-medium">No assets found</p>
              <p className="text-xs mt-1">Upload some content or adjust your filters</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {assets.map((asset) => (
                  <button key={asset.id} onClick={() => onSelect(asset.url)}
                    className="group relative aspect-[9/16] rounded-lg overflow-hidden border border-zinc-200 hover:border-orange-400 hover:ring-2 hover:ring-orange-200 transition-all bg-zinc-100 text-left"
                    onMouseEnter={(e) => { const v = e.currentTarget.querySelector('video'); if (v) v.play().catch(() => {}); }}
                    onMouseLeave={(e) => { const v = e.currentTarget.querySelector('video'); if (v) { v.pause(); v.currentTime = 0; } }}
                  >
                    {asset.file_type === 'image' ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={asset.url} alt={asset.filename || 'Asset'} draggable={false}
                        className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <video src={asset.url} muted={libraryMuted} playsInline preload="metadata"
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10px] text-white font-medium truncate">{asset.filename || 'Untitled'}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {asset.file_type === 'video' ? <Film className="h-2.5 w-2.5 text-blue-300" /> : <ImageIcon className="h-2.5 w-2.5 text-green-300" />}
                        <span className="text-[9px] text-zinc-300 capitalize">{asset.category}</span>
                      </div>
                    </div>
                    <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">Select</span>
                    </div>
                  </button>
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-6">
                  <Button variant="secondary" size="sm" onClick={loadMore} loading={loading}>
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
