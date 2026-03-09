'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  ArrowLeft, Wand2, Upload, Film, Type, CheckCircle, X,
  ImageIcon, Video, ChevronDown, ChevronRight, Eye, EyeOff, FolderOpen,
} from 'lucide-react';
import { AiHelper } from './ai-helper';
import { SceneCanvas } from '@/components/moderator/scene-canvas';
import { MediaLibraryModal } from '@/components/media-library-modal';
import Link from 'next/link';
import type { Template, TemplateScene, SceneElement, FontFamily } from '@/types';
import { FONT_FAMILIES, COLOR_SWATCHES } from '@/types';

interface EditorProps {
  template: Template;
}

function elementKey(si: number, ei: number) { return `scene_${si}_el_${ei}`; }

function getEditableTextElements(scenes: TemplateScene[]) {
  const result: { key: string; label: string; sceneIdx: number; elIdx: number }[] = [];
  scenes.forEach((s, si) => s.elements.forEach((el, ei) => {
    if (el.editable && el.type === 'text' && el.ai_suggest)
      result.push({ key: elementKey(si, ei), label: `${s.scene_name} — ${el.label}`, sceneIdx: si, elIdx: ei });
  }));
  return result;
}

export function TemplateEditor({ template }: EditorProps) {
  const router = useRouter();

  const [scenes, setScenes] = useState<TemplateScene[]>(() =>
    (template.config_json.scenes || []).map((s) => ({
      ...s,
      elements: (s.elements || []).map((el) => ({ ...el })),
    }))
  );
  const [activeScene, setActiveScene] = useState(0);
  const [selectedElement, setSelectedElement] = useState<number | null>(null);
  const [showCanvas, setShowCanvas] = useState(true);

  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    scenes.forEach((s, si) => s.elements.forEach((el, ei) => {
      if (el.editable && el.type === 'text' && el.default_value)
        initial[elementKey(si, ei)] = el.default_value;
    }));
    return initial;
  });
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [uploadedUrls, setUploadedUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAi, setShowAi] = useState(false);
  const [openStyles, setOpenStyles] = useState<Record<string, boolean>>({});
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryAccept, setLibraryAccept] = useState<'video' | 'image' | 'all'>('all');
  const [libraryCallback, setLibraryCallback] = useState<{ fn: (url: string) => void }>({ fn: () => {} });

  function openLibrary(accept: 'video' | 'image' | 'all', onSelect: (url: string) => void) {
    setLibraryAccept(accept);
    setLibraryCallback({ fn: onSelect });
    setLibraryOpen(true);
  }

  const updateInput = useCallback((key: string, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateElement = useCallback((si: number, ei: number, updates: Partial<SceneElement>) => {
    setScenes((prev) => prev.map((s, i) => i !== si ? s : {
      ...s,
      elements: s.elements.map((el, j) => j !== ei ? el : { ...el, ...updates }),
    }));
  }, []);

  const liveText = useMemo(() => {
    const map: Record<number, string> = {};
    const scene = scenes[activeScene];
    if (!scene) return map;
    scene.elements.forEach((el, i) => {
      if (el.type === 'text') {
        const key = elementKey(activeScene, i);
        map[i] = inputs[key] || el.default_value || '';
      }
    });
    return map;
  }, [scenes, activeScene, inputs]);

  const liveMedia = useMemo(() => {
    const map: Record<number, string> = {};
    const scene = scenes[activeScene];
    if (!scene) return map;
    scene.elements.forEach((el, i) => {
      const key = elementKey(activeScene, i);
      const url = uploadedUrls[key] || el.src;
      if (url) map[i] = url;
    });
    return map;
  }, [scenes, activeScene, uploadedUrls]);

  async function uploadFile(key: string, file: File) {
    setUploading((prev) => ({ ...prev, [key]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadedUrls((prev) => ({ ...prev, [key]: data.url }));
      setFiles((prev) => ({ ...prev, [key]: file }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }));
    }
  }

  function handleFileSelect(key: string, file: File | null) {
    if (file) { uploadFile(key, file); }
    else {
      setFiles((prev) => ({ ...prev, [key]: null }));
      setUploadedUrls((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
  }

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      const finalInputs: Record<string, string> = { ...inputs, ...uploadedUrls };
      scenes.forEach((s, si) => s.elements.forEach((el, ei) => {
        if (!el.editable) return;
        const key = elementKey(si, ei);
        const style: Record<string, unknown> = {};
        if (el.x != null) style.x = el.x;
        if (el.y != null) style.y = el.y;
        if (el.width != null) style.width = el.width;
        if (el.height != null) style.height = el.height;
        if (el.type === 'text') {
          if (el.fontFamily != null) style.fontFamily = el.fontFamily;
          if (el.fontSize != null) style.fontSize = el.fontSize;
          if (el.fontColor != null) style.fontColor = el.fontColor;
          if (el.fontWeight != null) style.fontWeight = el.fontWeight;
          if (el.dropShadow != null) style.dropShadow = el.dropShadow;
          if (el.shadowColor != null) style.shadowColor = el.shadowColor;
          if (el.shadowX != null) style.shadowX = el.shadowX;
          if (el.shadowY != null) style.shadowY = el.shadowY;
          if (el.opacity != null) style.opacity = el.opacity;
        }
        if (Object.keys(style).length > 0) {
          finalInputs[`${key}_style`] = JSON.stringify(style);
        }
      }));
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: template.id, inputs_json: finalInputs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create project');
      router.push(`/dashboard/projects/${data.data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function renderFileUpload(el: SceneElement, key: string, accept: string, typeLabel: string, icon: React.ReactNode) {
    if (!el.editable) {
      return (
        <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-100">
          {icon}
          <span className="text-sm text-zinc-500">{el.label}</span>
          {el.src ? <span className="ml-auto text-xs text-emerald-500">Included</span>
                   : <span className="ml-auto text-xs text-zinc-400">Fixed</span>}
        </div>
      );
    }
    const currentFile = files[key];
    const isUploading = uploading[key];
    const isUploaded = !!uploadedUrls[key];
    return (
      <div key={key} className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-zinc-700">{el.label}</span>
        </div>
        {isUploaded && currentFile ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-800 truncate">{currentFile.name}</p>
              <p className="text-xs text-emerald-600">Uploaded successfully</p>
            </div>
            <button onClick={() => handleFileSelect(key, null)} className="text-emerald-400 hover:text-red-500 transition-colors"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex gap-2">
            <label className="flex-1 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 hover:border-orange-400 bg-zinc-50 px-4 py-6 cursor-pointer transition-colors">
              {isUploading ? (
                <><div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" /><span className="text-sm text-zinc-500">Uploading...</span></>
              ) : (
                <><Upload className="h-8 w-8 text-zinc-400" /><span className="text-sm text-zinc-600 font-medium">Upload {typeLabel}</span><span className="text-xs text-zinc-400">{accept === 'image/*' ? 'PNG, JPG, WebP' : 'MP4, WebM, MOV'}</span></>
              )}
              <input type="file" accept={accept} className="hidden" disabled={isUploading}
                onChange={(e) => { const f = e.target.files?.[0] || null; if (f) handleFileSelect(key, f); }} />
            </label>
            <button type="button"
              onClick={() => openLibrary(accept === 'image/*' ? 'image' : 'video', (url) => {
                setUploadedUrls((prev) => ({ ...prev, [key]: url }));
                setFiles((prev) => ({ ...prev, [key]: new File([], 'from-library') }));
              })}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 hover:border-orange-400 bg-zinc-50 px-4 transition-colors text-zinc-500 hover:text-orange-600">
              <FolderOpen className="h-6 w-6" />
              <span className="text-xs font-medium">Library</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderTextStyle(el: SceneElement, si: number, ei: number) {
    const key = elementKey(si, ei);
    const isOpen = openStyles[key];
    return (
      <div className="mt-2 border border-zinc-100 rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50"
          onClick={() => setOpenStyles((p) => ({ ...p, [key]: !p[key] }))}
        >
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Text Style
        </button>
        {isOpen && (
          <div className="px-3 pb-3 space-y-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Font</label>
              <select className="w-full text-sm border border-zinc-200 rounded-md px-2 py-1.5 bg-white"
                value={el.fontFamily || 'Arial'}
                onChange={(e) => updateElement(si, ei, { fontFamily: e.target.value as FontFamily })}
              >
                {FONT_FAMILIES.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Size</label>
                <input type="range" min={12} max={120} value={el.fontSize || 48}
                  className="w-full accent-orange-500"
                  onChange={(e) => updateElement(si, ei, { fontSize: +e.target.value })} />
                <span className="text-xs text-zinc-400 text-center block">{el.fontSize || 48}px</span>
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Weight</label>
                <div className="flex gap-1">
                  {(['normal', 'bold'] as const).map((w) => (
                    <button key={w} onClick={() => updateElement(si, ei, { fontWeight: w })}
                      className={`flex-1 text-xs py-1.5 rounded border ${el.fontWeight === w || (!el.fontWeight && w === 'bold') ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-zinc-200 text-zinc-500'}`}
                    >{w}</button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Color</label>
              <div className="flex gap-1.5 flex-wrap">
                {COLOR_SWATCHES.map((c) => (
                  <button key={c} onClick={() => updateElement(si, ei, { fontColor: c })}
                    className="w-6 h-6 rounded-full border-2 transition-all"
                    style={{ backgroundColor: c, borderColor: (el.fontColor || '#ffffff') === c ? 'rgb(249,115,22)' : 'transparent' }} />
                ))}
                <input type="color" value={el.fontColor || '#ffffff'} className="w-6 h-6 rounded-full border-0 cursor-pointer"
                  onChange={(e) => updateElement(si, ei, { fontColor: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-500">Drop Shadow</label>
              <button onClick={() => updateElement(si, ei, { dropShadow: !el.dropShadow })}
                className={`w-9 h-5 rounded-full transition-colors ${el.dropShadow ? 'bg-orange-500' : 'bg-zinc-200'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${el.dropShadow ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderElement(el: SceneElement, si: number, ei: number) {
    const key = elementKey(si, ei);
    if (el.type === 'text') {
      if (!el.editable) {
        return (
          <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-100">
            <Type className="h-4 w-4 text-zinc-400 shrink-0" />
            <span className="text-sm text-zinc-500">{el.label}</span>
            <span className="ml-auto text-xs text-zinc-400">Fixed</span>
          </div>
        );
      }
      return (
        <div key={key} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-orange-500" />
            <label className="text-sm font-medium text-zinc-700">{el.label}</label>
            {el.ai_suggest && (
              <span className="ml-auto text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Wand2 className="h-3 w-3" />AI
              </span>
            )}
          </div>
          <textarea
            placeholder={`Enter ${el.label.toLowerCase()}`}
            value={inputs[key] || ''}
            onChange={(e) => updateInput(key, e.target.value)}
            rows={2}
            className="flex w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors resize-none border-zinc-300 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            style={{ minHeight: 40, height: 'auto' }}
            onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
          />
          {renderTextStyle(el, si, ei)}
        </div>
      );
    }
    if (el.type === 'video_slot')
      return renderFileUpload(el, key, 'video/*', 'video', <Film className={`h-4 w-4 ${el.editable ? 'text-blue-500' : 'text-zinc-400'}`} />);
    if (el.type === 'video')
      return renderFileUpload(el, key, 'video/*', 'video', <Video className={`h-4 w-4 ${el.editable ? 'text-purple-500' : 'text-zinc-400'}`} />);
    if (el.type === 'image')
      return renderFileUpload(el, key, 'image/*', 'image', <ImageIcon className={`h-4 w-4 ${el.editable ? 'text-emerald-500' : 'text-zinc-400'}`} />);
    return null;
  }

  const aiFields = getEditableTextElements(scenes);
  const currentScene = scenes[activeScene];

  const [showSample, setShowSample] = useState(false);

  return (
    <div className="h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0 mb-2">
        <Link href="/dashboard/templates">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-zinc-900 truncate">Remix: {template.name}</h1>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{template.description}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowCanvas((p) => !p)} className="lg:hidden">
          {showCanvas ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Canvas column */}
        <div className={`lg:col-span-5 ${showCanvas ? '' : 'hidden lg:block'} lg:h-full lg:overflow-y-auto lg:pr-1 flex flex-col`}>
          <div style={{ maxWidth: 'calc((100vh - 14rem) * 9 / 16)' }} className="mx-auto w-full shrink-0">
            <SceneCanvas
              elements={currentScene?.elements || []}
              backgroundVideo={currentScene?.background_video}
              selectedIndex={selectedElement}
              onSelect={setSelectedElement}
              onUpdateElement={(idx, updates) => updateElement(activeScene, idx, updates)}
              liveText={liveText}
              liveMedia={liveMedia}
              readonly
            />
          </div>

          {/* Timeline: scene strips below canvas (fixed-width, horiz scroll) */}
          {scenes.length > 1 && (
            <div className="mt-3 shrink-0 overflow-x-auto overflow-y-hidden scrollbar-thin" style={{ width: 'min(calc((100vh - 14rem) * 9 / 16 + 48px), 100%)' }}>
              <div className="flex gap-2 pb-1">
                {scenes.map((s, i) => (
                  <button key={i} onClick={() => { setActiveScene(i); setSelectedElement(null); }}
                    className={`shrink-0 w-24 rounded border-2 px-2 py-2 transition-all text-left bg-zinc-900/80 ${
                      activeScene === i
                        ? 'border-orange-500 text-orange-400'
                        : 'border-zinc-600 text-zinc-400 hover:border-orange-400'
                    }`}
                  >
                    <span className="text-xs font-medium truncate block">{s.scene_name || `Scene ${i + 1}`}</span>
                    <span className="text-[10px] text-zinc-500">{s.elements.length} elements</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sample preview: same size as canvas when expanded */}
          {template.preview_video_url && (
            <div className="mt-3 shrink-0">
              <button
                onClick={() => setShowSample((p) => !p)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                {showSample ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <Film className="h-3 w-3" />
                Sample Preview
              </button>
              {showSample && (
                <div style={{ maxWidth: 'calc((100vh - 14rem) * 9 / 16)' }} className="mx-auto mt-1.5">
                  <video src={template.preview_video_url} className="w-full rounded-lg aspect-[9/16] object-cover bg-zinc-900" controls playsInline />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Form column */}
        <div className="lg:col-span-7 space-y-3 lg:h-full overflow-y-auto pr-1">
          {currentScene && (
            <Card className="hover:border-orange-200 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">{activeScene + 1}</div>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-800">{currentScene.scene_name}</h2>
                    {currentScene.background_video && <p className="text-xs text-zinc-400">Has background video</p>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentScene.elements.map((el, ei) => renderElement(el, activeScene, ei))}
              </CardContent>
            </Card>
          )}

          {/* Other scenes (collapsed) */}
          {scenes.map((scene, si) => {
            if (si === activeScene) return null;
            const editableEls = scene.elements.filter((e) => e.editable);
            if (editableEls.length === 0) return null;
            return (
              <Card key={si} className="opacity-70 cursor-pointer hover:opacity-100 transition-opacity"
                onClick={() => { setActiveScene(si); setSelectedElement(null); }}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500">{si + 1}</div>
                    <div>
                      <p className="text-sm font-medium text-zinc-600">{scene.scene_name}</p>
                      <p className="text-xs text-zinc-400">{editableEls.length} editable elements</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {error && <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-3">{error}</p>}

          <div className="flex gap-3 pb-4">
            <Button onClick={handleSubmit} loading={loading} className="flex-1">Generate Video</Button>
            {aiFields.length > 0 && (
              <Button variant="secondary" onClick={() => setShowAi(true)}>
                <Wand2 className="h-4 w-4 mr-2" />AI Suggest
              </Button>
            )}
          </div>
        </div>
      </div>

      {aiFields.length > 0 && (
        <AiHelper open={showAi} onClose={() => setShowAi(false)}
          onApply={(key, value) => { updateInput(key, value); setShowAi(false); }}
          fields={aiFields} templateName={template.name} />
      )}

      <MediaLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        accept={libraryAccept}
        onSelect={(url) => { libraryCallback.fn(url); setLibraryOpen(false); }}
      />
    </div>
  );
}
