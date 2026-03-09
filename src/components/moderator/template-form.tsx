'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Plus, Trash2, Save, Rocket, GripVertical,
  Film, Type, Upload, CheckCircle, X, Loader2, ImageIcon, Video, FolderOpen,
} from 'lucide-react';
import Link from 'next/link';
import { SceneCanvas } from './scene-canvas';
import { MediaLibraryModal } from '@/components/media-library-modal';
import type { Template, TemplateScene, SceneElement, ElementType, TextPosition, FontFamily } from '@/types';
import { FONT_FAMILIES, COLOR_SWATCHES } from '@/types';

interface Props {
  template?: Template;
}

const ELEMENT_TYPES: { value: ElementType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'video_slot', label: 'Video Slot' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
];

function emptyElement(type: ElementType = 'text'): SceneElement {
  const defaults: Record<ElementType, Partial<SceneElement>> = {
    text:       { width: 80, height: 8, x: 10, y: 45 },
    video_slot: { width: 60, height: 35, x: 20, y: 30 },
    video:      { width: 40, height: 25, x: 30, y: 35 },
    image:      { width: 25, height: 15, x: 37, y: 5 },
  };
  return { type, label: '', editable: true, ...defaults[type] };
}

function emptyScene(): TemplateScene {
  return { scene_name: '', elements: [] };
}

function elTypeIcon(t: ElementType) {
  if (t === 'text') return <Type className="h-4 w-4 text-orange-500" />;
  if (t === 'video_slot') return <Film className="h-4 w-4 text-blue-500" />;
  if (t === 'video') return <Video className="h-4 w-4 text-purple-500" />;
  return <ImageIcon className="h-4 w-4 text-emerald-500" />;
}

export function TemplateForm({ template }: Props) {
  const router = useRouter();
  const isEdit = !!template;

  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [sampleVideoUrl, setSampleVideoUrl] = useState(template?.preview_video_url || '');
  const [sampleUploading, setSampleUploading] = useState(false);
  const [sampleFileName, setSampleFileName] = useState(template?.preview_video_url ? 'Uploaded video' : '');
  const [scenes, setScenes] = useState<TemplateScene[]>(
    (template?.config_json.scenes || []).map((s) => ({ ...s, elements: (s.elements || []).map(el => ({ x: undefined, y: undefined, width: undefined, height: undefined, ...el })) }))
  );
  const [selectedScene, setSelectedScene] = useState(0);
  const [selectedElement, setSelectedElement] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [bgUploading, setBgUploading] = useState<Record<number, boolean>>({});
  const [bgFileNames, setBgFileNames] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    (template?.config_json.scenes || []).forEach((s, i) => {
      if (s.background_video) initial[i] = 'Uploaded video';
    });
    return initial;
  });
  const [elUploading, setElUploading] = useState<Record<string, boolean>>({});
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryAccept, setLibraryAccept] = useState<'video' | 'image' | 'all'>('all');
  const [libraryCallback, setLibraryCallback] = useState<{ fn: (url: string) => void }>({ fn: () => {} });

  function openLibrary(accept: 'video' | 'image' | 'all', onSelect: (url: string) => void) {
    setLibraryAccept(accept);
    setLibraryCallback({ fn: onSelect });
    setLibraryOpen(true);
  }

  async function uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/moderator/templates/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data.url;
  }

  async function uploadSampleVideo(file: File) {
    setSampleUploading(true);
    setError('');
    try {
      const url = await uploadFile(file);
      setSampleVideoUrl(url);
      setSampleFileName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSampleUploading(false);
    }
  }

  function addScene() {
    setScenes([...scenes, emptyScene()]);
    setSelectedScene(scenes.length);
    setSelectedElement(null);
  }

  function updateScene(idx: number, updates: Partial<TemplateScene>) {
    setScenes(scenes.map((s, i) => i === idx ? { ...s, ...updates } : s));
  }

  function removeScene(idx: number) {
    const next = scenes.filter((_, i) => i !== idx);
    setScenes(next);
    if (selectedScene >= next.length) setSelectedScene(Math.max(0, next.length - 1));
    setSelectedElement(null);
    setBgFileNames((prev) => {
      const n: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => { const ki = parseInt(k); if (ki < idx) n[ki] = v; else if (ki > idx) n[ki - 1] = v; });
      return n;
    });
  }

  async function uploadBgVideo(sceneIdx: number, file: File) {
    setBgUploading((prev) => ({ ...prev, [sceneIdx]: true }));
    setError('');
    try {
      const url = await uploadFile(file);
      updateScene(sceneIdx, { background_video: url });
      setBgFileNames((prev) => ({ ...prev, [sceneIdx]: file.name }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBgUploading((prev) => ({ ...prev, [sceneIdx]: false }));
    }
  }

  function removeBgVideo(sceneIdx: number) {
    updateScene(sceneIdx, { background_video: undefined });
    setBgFileNames((prev) => { const n = { ...prev }; delete n[sceneIdx]; return n; });
  }

  function addElement(sceneIdx: number, type: ElementType = 'text') {
    setScenes(scenes.map((s, i) =>
      i === sceneIdx ? { ...s, elements: [...s.elements, emptyElement(type)] } : s
    ));
    setSelectedElement(scenes[sceneIdx]?.elements.length ?? null);
  }

  const updateElement = useCallback((sceneIdx: number, elIdx: number, updates: Partial<SceneElement>) => {
    setScenes(prev => prev.map((s, si) =>
      si === sceneIdx ? { ...s, elements: s.elements.map((el, ei) => ei === elIdx ? { ...el, ...updates } : el) } : s
    ));
  }, []);

  function removeElement(sceneIdx: number, elIdx: number) {
    setScenes(scenes.map((s, si) =>
      si === sceneIdx ? { ...s, elements: s.elements.filter((_, ei) => ei !== elIdx) } : s
    ));
    if (selectedElement === elIdx) setSelectedElement(null);
    else if (selectedElement !== null && selectedElement > elIdx) setSelectedElement(selectedElement - 1);
  }

  async function uploadElementAsset(sceneIdx: number, elIdx: number, file: File) {
    const key = `${sceneIdx}-${elIdx}`;
    setElUploading(prev => ({ ...prev, [key]: true }));
    setError('');
    try {
      const url = await uploadFile(file);
      updateElement(sceneIdx, elIdx, { src: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setElUploading(prev => ({ ...prev, [key]: false }));
    }
  }

  async function handleSave(publish: boolean) {
    setError('');
    if (!name.trim()) { setError('Template name is required'); return; }
    if (scenes.length === 0) { setError('Add at least one scene'); return; }
    for (const s of scenes) {
      if (!s.scene_name.trim()) { setError('All scenes must have a name'); return; }
      for (const el of s.elements) {
        if (!el.label.trim()) { setError('All elements must have a label'); return; }
        if ((el.type === 'video' || el.type === 'image') && !el.editable && !el.src) {
          setError(`Upload an asset for "${el.label}" or mark it editable`); return;
        }
      }
    }

    if (publish) { setPublishing(true); } else { setSaving(true); }

    try {
      const config_json = { scenes };
      const body: Record<string, unknown> = { name, description, config_json };
      if (sampleVideoUrl) body.preview_video_url = sampleVideoUrl;

      if (isEdit) {
        const res = await fetch(`/api/moderator/templates/${template.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error);

        if (publish) {
          const pubRes = await fetch(`/api/moderator/templates/${template.id}/publish`, { method: 'POST' });
          if (!pubRes.ok) throw new Error((await pubRes.json()).error);
        }
      } else {
        body.publish = publish;
        const res = await fetch('/api/moderator/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }

      router.push('/moderator/templates');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  }

  const currentScene = scenes[selectedScene];

  return (
    <div className="h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 shrink-0 mb-3">
        <Link href="/moderator/templates">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        {isEdit && template.status && (
          <Badge className="bg-zinc-100 text-zinc-600 capitalize">{template.status}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 flex-1 min-h-0 items-start">
        {/* Left column: info + scene list */}
        <div className="xl:col-span-4 space-y-3 xl:h-full xl:overflow-y-auto xl:pr-1">
          <Card>
            <CardHeader><h2 className="text-sm font-semibold text-zinc-800">Basic Info</h2></CardHeader>
            <CardContent className="space-y-4">
              <Input id="name" label="Template Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Product Showcase" />
              <Textarea id="desc" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what this template is for..." />

              <div>
                <span className="text-xs font-medium text-zinc-500 mb-1.5 block">Sample Video (template preview for users)</span>
                {sampleVideoUrl ? (
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <video src={sampleVideoUrl} className="h-12 w-8 rounded object-cover bg-zinc-900 shrink-0" controls playsInline />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="text-xs text-emerald-800 truncate">{sampleFileName}</span>
                      </div>
                    </div>
                    <button onClick={() => { setSampleVideoUrl(''); setSampleFileName(''); }} className="text-zinc-400 hover:text-red-500 shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center gap-3 rounded-lg border-2 border-dashed border-zinc-300 hover:border-orange-400 bg-zinc-50 px-3 py-3 cursor-pointer transition-colors">
                      {sampleUploading ? (
                        <><Loader2 className="h-5 w-5 text-orange-500 animate-spin shrink-0" /><span className="text-xs text-zinc-500">Uploading...</span></>
                      ) : (
                        <><Upload className="h-5 w-5 text-zinc-400 shrink-0" /><span className="text-xs text-zinc-600">Upload</span></>
                      )}
                      <input type="file" accept="video/*" className="hidden" disabled={sampleUploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSampleVideo(f); }} />
                    </label>
                    <button type="button" onClick={() => openLibrary('video', (url) => { setSampleVideoUrl(url); setSampleFileName('From library'); })}
                      className="flex items-center gap-1.5 rounded-lg border-2 border-dashed border-zinc-300 hover:border-orange-400 bg-zinc-50 px-3 py-3 transition-colors text-xs text-zinc-600 hover:text-orange-600">
                      <FolderOpen className="h-4 w-4" />Library
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">Scenes</h2>
            <Button variant="ghost" size="sm" onClick={addScene}><Plus className="h-4 w-4 mr-1" />Add Scene</Button>
          </div>

          {scenes.length === 0 && (
            <Card><CardContent className="py-6 text-center"><p className="text-sm text-zinc-400">No scenes yet.</p></CardContent></Card>
          )}

          {scenes.map((scene, si) => (
            <Card
              key={si}
              className={`cursor-pointer transition-colors ${selectedScene === si ? 'border-orange-400 border-l-4' : 'hover:border-zinc-300'}`}
              onClick={() => { setSelectedScene(si); setSelectedElement(null); }}
            >
              <CardContent className="py-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-zinc-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <input
                      value={scene.scene_name}
                      onChange={(e) => { e.stopPropagation(); updateScene(si, { scene_name: e.target.value }); }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Scene name"
                      className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-sm font-medium text-zinc-900 focus:border-orange-500 focus:outline-none"
                    />
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-zinc-400">{scene.elements.length} elements</span>
                      {scene.background_video && <span className="text-xs text-emerald-600">BG video</span>}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); removeScene(si); }} className="text-zinc-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="py-4 space-y-3">
              <Button onClick={() => handleSave(false)} loading={saving} variant="secondary" className="w-full">
                <Save className="h-4 w-4 mr-2" />Save as Draft
              </Button>
              <Button onClick={() => handleSave(true)} loading={publishing} className="w-full">
                <Rocket className="h-4 w-4 mr-2" />Save &amp; Publish
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Center: Canvas */}
        <div className="xl:col-span-4">
          {currentScene ? (
            <div className="space-y-3 xl:h-full xl:overflow-y-auto xl:pr-1">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-800">Canvas: {currentScene.scene_name || `Scene ${selectedScene + 1}`}</h2>
              </div>
              <div style={{ maxWidth: 'calc((100vh - 14rem) * 9 / 16)' }} className="mx-auto">
              <SceneCanvas
                elements={currentScene.elements}
                backgroundVideo={currentScene.background_video}
                selectedIndex={selectedElement}
                onSelect={setSelectedElement}
                onUpdateElement={(elIdx, updates) => updateElement(selectedScene, elIdx, updates)}
              />
              </div>
              <div>
                <span className="text-xs font-medium text-zinc-500 mb-1.5 block">Background Video</span>
                {currentScene.background_video ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-medium text-emerald-800 truncate flex-1">{bgFileNames[selectedScene] || 'Video uploaded'}</span>
                    <button onClick={() => removeBgVideo(selectedScene)} className="text-emerald-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 hover:border-orange-400 bg-zinc-50 px-3 py-2 cursor-pointer">
                      {bgUploading[selectedScene] ? (
                        <><Loader2 className="h-4 w-4 text-orange-500 animate-spin" /><span className="text-xs text-zinc-500">Uploading...</span></>
                      ) : (
                        <><Upload className="h-4 w-4 text-zinc-400" /><span className="text-xs text-zinc-600">Upload</span></>
                      )}
                      <input type="file" accept="video/*" className="hidden" disabled={bgUploading[selectedScene]}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBgVideo(selectedScene, f); }} />
                    </label>
                    <button type="button" onClick={() => { const si = selectedScene; openLibrary('video', (url) => { updateScene(si, { background_video: url }); setBgFileNames((p) => ({ ...p, [si]: 'From library' })); }); }}
                      className="flex items-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 hover:border-orange-400 bg-zinc-50 px-2 py-2 transition-colors text-xs text-zinc-600 hover:text-orange-600">
                      <FolderOpen className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 rounded-lg border-2 border-dashed border-zinc-200">
              <p className="text-sm text-zinc-400">Add a scene to start</p>
            </div>
          )}
        </div>

        {/* Right: Element properties */}
        <div className="xl:col-span-4 space-y-3 xl:h-full xl:overflow-y-auto xl:pr-1">
          {currentScene && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-800">Elements</h2>
                <div className="flex gap-1">
                  {ELEMENT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => addElement(selectedScene, t.value)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 transition-colors"
                      title={`Add ${t.label}`}
                    >
                      <Plus className="h-3 w-3" />{t.label}
                    </button>
                  ))}
                </div>
              </div>

              {currentScene.elements.length === 0 && (
                <Card><CardContent className="py-4 text-center"><p className="text-xs text-zinc-400">No elements. Add one above.</p></CardContent></Card>
              )}

              {currentScene.elements.map((el, ei) => {
                const isSelected = selectedElement === ei;
                const elUpKey = `${selectedScene}-${ei}`;
                return (
                  <Card
                    key={ei}
                    className={`transition-colors cursor-pointer ${isSelected ? 'border-orange-400 ring-1 ring-orange-200' : 'hover:border-zinc-300'}`}
                    onClick={() => setSelectedElement(ei)}
                  >
                    <CardContent className="py-3 space-y-3">
                      <div className="flex items-center gap-2">
                        {elTypeIcon(el.type)}
                        <select
                          value={el.type}
                          onChange={(e) => updateElement(selectedScene, ei, { type: e.target.value as ElementType })}
                          className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-orange-500 focus:outline-none"
                        >
                          {ELEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <input
                          value={el.label}
                          onChange={(e) => updateElement(selectedScene, ei, { label: e.target.value })}
                          placeholder="Label"
                          className="flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-orange-500 focus:outline-none"
                        />
                        <button onClick={(e) => { e.stopPropagation(); removeElement(selectedScene, ei); }} className="text-zinc-400 hover:text-red-500">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-1 text-xs text-zinc-600 cursor-pointer">
                          <input type="checkbox" checked={el.editable} onChange={(e) => updateElement(selectedScene, ei, { editable: e.target.checked })}
                            className="rounded border-zinc-300 text-orange-500 focus:ring-orange-500" />
                          Editable
                        </label>
                        {el.type === 'text' && (
                          <label className="flex items-center gap-1 text-xs text-zinc-600 cursor-pointer">
                            <input type="checkbox" checked={el.ai_suggest || false} onChange={(e) => updateElement(selectedScene, ei, { ai_suggest: e.target.checked })}
                              className="rounded border-zinc-300 text-orange-500 focus:ring-orange-500" />
                            AI Suggest
                          </label>
                        )}
                      </div>

                      {/* Position / size controls */}
                      {isSelected && (
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[10px] text-zinc-400 block">X %</label>
                            <input type="number" min={0} max={100} step={0.5} value={el.x ?? 0}
                              onChange={(e) => updateElement(selectedScene, ei, { x: parseFloat(e.target.value) || 0 })}
                              className="w-full rounded border border-zinc-200 px-1.5 py-1 text-xs text-zinc-900 focus:border-orange-500 focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block">Y %</label>
                            <input type="number" min={0} max={100} step={0.5} value={el.y ?? 0}
                              onChange={(e) => updateElement(selectedScene, ei, { y: parseFloat(e.target.value) || 0 })}
                              className="w-full rounded border border-zinc-200 px-1.5 py-1 text-xs text-zinc-900 focus:border-orange-500 focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block">W %</label>
                            <input type="number" min={5} max={100} step={0.5} value={el.width ?? 30}
                              onChange={(e) => updateElement(selectedScene, ei, { width: parseFloat(e.target.value) || 30 })}
                              className="w-full rounded border border-zinc-200 px-1.5 py-1 text-xs text-zinc-900 focus:border-orange-500 focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 block">H %</label>
                            <input type="number" min={3} max={100} step={0.5} value={el.height ?? 10}
                              onChange={(e) => updateElement(selectedScene, ei, { height: parseFloat(e.target.value) || 10 })}
                              className="w-full rounded border border-zinc-200 px-1.5 py-1 text-xs text-zinc-900 focus:border-orange-500 focus:outline-none" />
                          </div>
                        </div>
                      )}

                      {/* Text-specific: position preset + default value */}
                      {el.type === 'text' && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <select value={el.position || 'center'} onChange={(e) => updateElement(selectedScene, ei, { position: e.target.value as TextPosition })}
                              className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs focus:border-orange-500 focus:outline-none">
                              <option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option>
                            </select>
                            {!el.editable && (
                              <textarea value={el.default_value || ''} onChange={(e) => updateElement(selectedScene, ei, { default_value: e.target.value })}
                                placeholder="Default text" rows={2}
                                className="flex-1 rounded border border-zinc-200 bg-white px-2 py-1 text-xs focus:border-orange-500 focus:outline-none resize-none"
                                onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }} />
                            )}
                          </div>
                          {isSelected && (
                            <div className="space-y-2 border-t border-zinc-100 pt-2">
                              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Text Style</span>
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-0.5">Font</label>
                                <select className="w-full rounded border border-zinc-200 bg-white px-2 py-1 text-xs focus:border-orange-500 focus:outline-none"
                                  value={el.fontFamily || 'Arial'}
                                  onChange={(e) => updateElement(selectedScene, ei, { fontFamily: e.target.value as FontFamily })}>
                                  {FONT_FAMILIES.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                                </select>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-zinc-400 block mb-0.5">Size</label>
                                  <input type="number" min={12} max={120} value={el.fontSize || 48}
                                    onChange={(e) => updateElement(selectedScene, ei, { fontSize: +e.target.value })}
                                    className="w-full rounded border border-zinc-200 px-1.5 py-1 text-xs focus:border-orange-500 focus:outline-none" />
                                </div>
                                <div>
                                  <label className="text-[10px] text-zinc-400 block mb-0.5">Weight</label>
                                  <div className="flex gap-1">
                                    {(['normal', 'bold'] as const).map((w) => (
                                      <button key={w} type="button" onClick={() => updateElement(selectedScene, ei, { fontWeight: w })}
                                        className={`flex-1 text-[10px] py-1 rounded border ${(el.fontWeight || 'bold') === w ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-zinc-200 text-zinc-500'}`}
                                      >{w}</button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-400 block mb-0.5">Color</label>
                                <div className="flex gap-1 flex-wrap items-center">
                                  {COLOR_SWATCHES.map((c) => (
                                    <button key={c} type="button" onClick={() => updateElement(selectedScene, ei, { fontColor: c })}
                                      className="w-5 h-5 rounded-full border-2 transition-all"
                                      style={{ backgroundColor: c, borderColor: (el.fontColor || '#ffffff') === c ? 'rgb(249,115,22)' : 'transparent' }} />
                                  ))}
                                  <input type="color" value={el.fontColor || '#ffffff'} className="w-5 h-5 rounded-full border-0 cursor-pointer"
                                    onChange={(e) => updateElement(selectedScene, ei, { fontColor: e.target.value })} />
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] text-zinc-400">Drop Shadow</label>
                                <button type="button" onClick={() => updateElement(selectedScene, ei, { dropShadow: !el.dropShadow })}
                                  className={`w-8 h-4 rounded-full transition-colors ${el.dropShadow ? 'bg-orange-500' : 'bg-zinc-200'}`}>
                                  <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${el.dropShadow ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                </button>
                              </div>
                              {el.dropShadow && (
                                <div className="grid grid-cols-3 gap-1">
                                  <div>
                                    <label className="text-[10px] text-zinc-400 block">Shadow X</label>
                                    <input type="number" min={-10} max={10} value={el.shadowX ?? 2}
                                      onChange={(e) => updateElement(selectedScene, ei, { shadowX: +e.target.value })}
                                      className="w-full rounded border border-zinc-200 px-1 py-0.5 text-[10px] focus:border-orange-500 focus:outline-none" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-zinc-400 block">Shadow Y</label>
                                    <input type="number" min={-10} max={10} value={el.shadowY ?? 2}
                                      onChange={(e) => updateElement(selectedScene, ei, { shadowY: +e.target.value })}
                                      className="w-full rounded border border-zinc-200 px-1 py-0.5 text-[10px] focus:border-orange-500 focus:outline-none" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-zinc-400 block">Color</label>
                                    <input type="color" value={el.shadowColor || '#000000'}
                                      onChange={(e) => updateElement(selectedScene, ei, { shadowColor: e.target.value })}
                                      className="w-full h-6 rounded border-0 cursor-pointer" />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Video / Image asset upload + styling */}
                      {(el.type === 'video' || el.type === 'image') && (
                        <div className="space-y-2">
                          {el.src ? (
                            <div className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                              <CheckCircle className="h-3 w-3 text-emerald-600 shrink-0" />
                              <span className="text-xs text-emerald-800 truncate flex-1">Asset uploaded</span>
                              <button onClick={() => updateElement(selectedScene, ei, { src: undefined })} className="text-emerald-400 hover:text-red-500">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <label className="flex-1 flex items-center gap-2 rounded border-2 border-dashed border-zinc-300 hover:border-orange-400 bg-zinc-50 px-2 py-2 cursor-pointer">
                                {elUploading[elUpKey] ? (
                                  <><Loader2 className="h-4 w-4 text-orange-500 animate-spin" /><span className="text-xs text-zinc-500">Uploading...</span></>
                                ) : (
                                  <><Upload className="h-4 w-4 text-zinc-400" /><span className="text-xs text-zinc-600">Upload</span></>
                                )}
                                <input type="file" accept={el.type === 'image' ? 'image/*' : 'video/*'} className="hidden" disabled={!!elUploading[elUpKey]}
                                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadElementAsset(selectedScene, ei, f); }} />
                              </label>
                              <button type="button" onClick={() => { const si = selectedScene; const idx = ei; openLibrary(el.type === 'image' ? 'image' : 'video', (url) => updateElement(si, idx, { src: url })); }}
                                className="flex items-center gap-1 rounded border-2 border-dashed border-zinc-300 hover:border-orange-400 bg-zinc-50 px-2 py-2 transition-colors text-xs text-zinc-600 hover:text-orange-600">
                                <FolderOpen className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          {isSelected && (
                            <div className="space-y-2 border-t border-zinc-100 pt-2">
                              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Media Style</span>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-zinc-400 block mb-0.5">Opacity</label>
                                  <input type="range" min={0} max={1} step={0.05} value={el.opacity ?? 1}
                                    className="w-full accent-orange-500"
                                    onChange={(e) => updateElement(selectedScene, ei, { opacity: +e.target.value })} />
                                  <span className="text-[10px] text-zinc-400 block text-center">{Math.round((el.opacity ?? 1) * 100)}%</span>
                                </div>
                                <div>
                                  <label className="text-[10px] text-zinc-400 block mb-0.5">Fit</label>
                                  <div className="flex gap-1">
                                    {(['cover', 'contain'] as const).map((f) => (
                                      <button key={f} type="button" onClick={() => updateElement(selectedScene, ei, { objectFit: f })}
                                        className={`flex-1 text-[10px] py-1 rounded border ${(el.objectFit || 'cover') === f ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-zinc-200 text-zinc-500'}`}
                                      >{f}</button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              {el.type === 'image' && (
                                <div>
                                  <label className="text-[10px] text-zinc-400 block mb-0.5">Border Radius (px)</label>
                                  <input type="number" min={0} max={50} value={el.borderRadius ?? 0}
                                    onChange={(e) => updateElement(selectedScene, ei, { borderRadius: +e.target.value })}
                                    className="w-full rounded border border-zinc-200 px-1.5 py-1 text-xs focus:border-orange-500 focus:outline-none" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 shrink-0">{error}</p>}

      <MediaLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        accept={libraryAccept}
        onSelect={(url) => { libraryCallback.fn(url); setLibraryOpen(false); }}
      />
    </div>
  );
}
