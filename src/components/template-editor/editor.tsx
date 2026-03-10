'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  ArrowLeft, Wand2, Upload, Film, Type, CheckCircle, X,
  ImageIcon, Video, ChevronDown, ChevronRight, Eye, EyeOff, FolderOpen, RefreshCw, Send,
} from 'lucide-react';
import { AiHelper } from './ai-helper';
import { SceneCanvas } from '@/components/moderator/scene-canvas';
import { MediaLibraryModal } from '@/components/media-library-modal';
import Link from 'next/link';
import type { Template, TemplateScene, SceneElement, FontFamily, Project } from '@/types';
import { FONT_FAMILIES, COLOR_SWATCHES } from '@/types';

interface EditorProps {
  template: Template;
  /** When provided, we're editing an existing project (remix mode) */
  project?: Project;
}

function elementKey(si: number, ei: number) { return `scene_${si}_el_${ei}`; }

function getSceneBackground(scene: TemplateScene): string | undefined {
  return scene.background_video || scene.elements.find((el) => el.type === 'video' && !el.editable && el.src && (el.width ?? 50) >= 90 && (el.height ?? 30) >= 90)?.src;
}

function getEditableTextElements(scenes: TemplateScene[]) {
  const result: { key: string; label: string; sceneIdx: number; elIdx: number }[] = [];
  scenes.forEach((s, si) => s.elements.forEach((el, ei) => {
    if (el.editable && el.type === 'text' && el.ai_suggest)
      result.push({ key: elementKey(si, ei), label: `${s.scene_name} — ${el.label}`, sceneIdx: si, elIdx: ei });
  }));
  return result;
}

function buildInitialStateFromProject(template: Template, inputsJson: Record<string, string>) {
  const baseScenes = (template.config_json.scenes || []).map((s) => ({
    ...s,
    elements: (s.elements || []).map((el) => ({ ...el })),
  }));

  const inputs: Record<string, string> = {};
  const uploadedUrls: Record<string, string> = {};
  const scenes = baseScenes.map((s, si) => ({
    ...s,
    elements: s.elements.map((el, ei) => {
      const key = elementKey(si, ei);
      const styleRaw = inputsJson[`${key}_style`];
      let style: Record<string, unknown> = {};
      if (styleRaw) {
        try {
          style = typeof styleRaw === 'string' ? (JSON.parse(styleRaw) as Record<string, unknown>) : (styleRaw as Record<string, unknown>);
        } catch { /* ignore */ }
      }
      const val = inputsJson[key];
      if (val != null && val !== '') {
        if (val.startsWith('http://') || val.startsWith('https://')) {
          if (el.type === 'video' || el.type === 'image') uploadedUrls[key] = val;
          else inputs[key] = val;
        } else {
          inputs[key] = val;
        }
      } else if (el.type === 'text' && el.default_value) {
        inputs[key] = el.default_value;
      }
      return { ...el, ...style } as SceneElement;
    }),
  }));

  return { scenes, inputs, uploadedUrls };
}

export function TemplateEditor({ template, project }: EditorProps) {
  const router = useRouter();
  const isEditMode = !!project;

  const [scenes, setScenes] = useState<TemplateScene[]>(() => {
    if (project?.inputs_json && Object.keys(project.inputs_json).length > 0) {
      return buildInitialStateFromProject(template, project.inputs_json).scenes;
    }
    return (template.config_json.scenes || []).map((s) => ({
      ...s,
      elements: (s.elements || []).map((el) => ({ ...el })),
    }));
  });
  const [activeScene, setActiveScene] = useState(0);
  const [selectedElement, setSelectedElement] = useState<number | null>(null);
  const [showCanvas, setShowCanvas] = useState(true);
  const [projectName, setProjectName] = useState(() =>
    project?.name?.trim() || ''
  );

  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    if (project?.inputs_json && Object.keys(project.inputs_json).length > 0) {
      return buildInitialStateFromProject(template, project.inputs_json).inputs;
    }
    const initial: Record<string, string> = {};
    (template.config_json.scenes || []).forEach((s, si) => s.elements.forEach((el, ei) => {
      if (el.editable && el.type === 'text' && el.default_value)
        initial[elementKey(si, ei)] = el.default_value;
    }));
    return initial;
  });
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [uploadedUrls, setUploadedUrls] = useState<Record<string, string>>(() => {
    if (project?.inputs_json && Object.keys(project.inputs_json).length > 0) {
      return buildInitialStateFromProject(template, project.inputs_json).uploadedUrls;
    }
    return {};
  });
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [, setError] = useState('');
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

  function buildFinalInputs(): Record<string, string> {
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
    return finalInputs;
  }

  async function handleSubmit(andRender = false) {
    setError('');
    setLoading(true);
    try {
      const finalInputs = buildFinalInputs();
      let projectId: string;

      if (isEditMode && project) {
        const updates: Record<string, unknown> = { inputs_json: finalInputs };
        if (projectName.trim()) updates.name = projectName.trim();
        else if (projectName === '' && project.name) updates.name = null;
        const res = await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update project');
        projectId = project.id;
      } else {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: template.id,
            inputs_json: finalInputs,
            name: projectName.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create project');
        projectId = data.data.id;
      }

      if (andRender) {
        const contentRes = await fetch('/api/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: projectId, name: projectName.trim() || undefined }),
        });
        const contentData = await contentRes.json();
        if (!contentRes.ok) throw new Error(contentData.error || 'Failed to queue render');
        router.push(`/dashboard/content/${contentData.data.id}`);
      } else {
        router.push(`/dashboard/projects/${projectId}`);
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAndPublish() {
    setError('');
    setLoading(true);
    try {
      const finalInputs = buildFinalInputs();
      let projectId: string;

      if (isEditMode && project) {
        const updates: Record<string, unknown> = { inputs_json: finalInputs };
        if (projectName.trim()) updates.name = projectName.trim();
        else if (projectName === '' && project.name) updates.name = null;
        const res = await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update project');
        projectId = project.id;
      } else {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: template.id,
            inputs_json: finalInputs,
            name: projectName.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create project');
        projectId = data.data.id;
      }

      const contentRes = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, name: projectName.trim() || undefined }),
      });
      const contentData = await contentRes.json();
      if (!contentRes.ok) throw new Error(contentData.error || 'Failed to publish');
      router.push(`/dashboard/content/${contentData.data.id}`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function renderFileUpload(el: SceneElement, key: string, accept: string, typeLabel: string, icon: React.ReactNode) {
    if (!el.editable) {
      return (
        <div key={key} className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-100 border border-zinc-200">
          {icon}
          <span className="text-sm text-zinc-500">{el.label}</span>
          {el.src ? <span className="ml-auto text-xs text-emerald-400">Included</span>
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
          <div className="flex items-center gap-3 rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-emerald-300 truncate">{currentFile.name}</p>
              <p className="text-xs text-emerald-400">Uploaded successfully</p>
            </div>
            <button onClick={() => handleFileSelect(key, null)} className="text-emerald-400 hover:text-red-500 transition-colors"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="flex gap-2">
            <label className="flex-1 flex flex-col items-center gap-2 rounded border-2 border-dashed border-zinc-300 hover:border-orange-500 bg-zinc-50 px-4 py-6 cursor-pointer transition-colors">
              {isUploading ? (
                <><div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" /><span className="text-sm text-zinc-500">Uploading...</span></>
              ) : (
                <><Upload className="h-8 w-8 text-orange-500/70" /><span className="text-sm text-zinc-300 font-medium">Upload {typeLabel}</span><span className="text-xs text-zinc-500">{accept === 'image/*' ? 'PNG, JPG, WebP' : 'MP4, WebM, MOV'}</span></>
              )}
              <input type="file" accept={accept} className="hidden" disabled={isUploading}
                onChange={(e) => { const f = e.target.files?.[0] || null; if (f) handleFileSelect(key, f); }} />
            </label>
            <button type="button"
              onClick={() => openLibrary(accept === 'image/*' ? 'image' : 'video', (url) => {
                setUploadedUrls((prev) => ({ ...prev, [key]: url }));
                setFiles((prev) => ({ ...prev, [key]: new File([], 'from-library') }));
              })}
              className="flex flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-zinc-300 hover:border-orange-500 bg-zinc-50 px-4 transition-colors text-zinc-400 hover:text-orange-400">
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
      <div className="mt-2 border border-zinc-200 rounded overflow-hidden">
        <button
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
          onClick={() => setOpenStyles((p) => ({ ...p, [key]: !p[key] }))}
        >
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Text Style
        </button>
        {isOpen && (
          <div className="px-3 pb-3 space-y-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Font</label>
              <select className="w-full text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white text-zinc-900"
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
                      className={`flex-1 text-xs py-1.5 rounded border ${el.fontWeight === w || (!el.fontWeight && w === 'bold') ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'border-zinc-300 text-zinc-500'}`}
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
                className={`w-9 h-5 rounded-full transition-colors ${el.dropShadow ? 'bg-orange-500' : 'bg-zinc-700'}`}>
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
          <div key={key} className="flex items-center gap-2 px-3 py-2 rounded bg-zinc-100 border border-zinc-200">
            <Type className="h-4 w-4 text-zinc-500 shrink-0" />
            <span className="text-sm text-zinc-500">{el.label}</span>
            <span className="ml-auto text-xs text-zinc-400">Fixed</span>
          </div>
        );
      }
      return (
        <div key={key} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-orange-500" />
            <label className="text-sm font-medium text-zinc-300">{el.label}</label>
            {el.ai_suggest && (
              <span className="ml-auto text-xs text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded flex items-center gap-1">
                <Wand2 className="h-3 w-3" />AI
              </span>
            )}
          </div>
          <textarea
            placeholder={`Enter ${el.label.toLowerCase()}`}
            value={inputs[key] || ''}
            onChange={(e) => updateInput(key, e.target.value)}
            rows={2}
            className="flex w-full rounded border bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors resize-none border-zinc-300 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            style={{ minHeight: 40, height: 'auto' }}
            onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
          />
          {renderTextStyle(el, si, ei)}
        </div>
      );
    }
    if (el.type === 'video')
      return renderFileUpload(el, key, 'video/*', 'video', <Video className={`h-4 w-4 ${el.editable ? 'text-blue-500' : 'text-zinc-400'}`} />);
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
        <Link href={isEditMode ? '/dashboard/projects' : '/dashboard/templates'}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold uppercase tracking-widest text-orange-500 truncate">
            {isEditMode ? 'Edit Project' : 'Remix'}: {template.name}
          </h1>
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
              backgroundVideo={currentScene ? getSceneBackground(currentScene) : undefined}
              selectedIndex={selectedElement}
              onSelect={setSelectedElement}
              onUpdateElement={(idx, updates) => updateElement(activeScene, idx, updates)}
              liveText={liveText}
              liveMedia={liveMedia}
              readonly
            />
          </div>

          {/* Timeline: editing timeline strip */}
          {scenes.length > 1 && (
            <div
              className="mt-3 shrink-0 mx-auto rounded-lg border border-zinc-200 bg-zinc-100 overflow-hidden"
              style={{ width: 'min(calc((100vh - 14rem) * 9 / 16 + 48px), 100%)' }}
            >
              <div className="flex items-center justify-center border-b border-zinc-200 px-2 py-1.5 bg-zinc-50">
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Scenes</span>
              </div>
              <div className="flex justify-center overflow-x-auto overflow-y-hidden scrollbar-none max-w-full p-2">
                <div className="flex gap-1.5 min-w-max justify-center">
                  {scenes.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setActiveScene(i); setSelectedElement(null); }}
                      className={`shrink-0 flex items-center gap-2 rounded px-3 py-2 transition-all text-left min-w-0 ${
                        activeScene === i
                          ? 'bg-orange-100 text-orange-600 border border-orange-300'
                          : 'bg-white text-zinc-600 border border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400'
                      }`}
                    >
                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${activeScene === i ? 'bg-orange-500' : 'bg-zinc-400'}`} />
                      <span className="text-xs font-medium truncate">{s.scene_name || `Scene ${i + 1}`}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Sample preview: same size as canvas when expanded */}
          {template.preview_video_url && (
            <div className="mt-3 shrink-0">
              <button
                onClick={() => setShowSample((p) => !p)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 rounded transition-colors"
              >
                {showSample ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <Film className="h-3 w-3" />
                Sample Preview
              </button>
              {showSample && (
                <div style={{ maxWidth: 'calc((100vh - 14rem) * 9 / 16)' }} className="mx-auto mt-1.5">
                  <video src={template.preview_video_url} className="w-full rounded-lg aspect-[9/16] object-cover bg-zinc-100" controls playsInline />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Form column */}
        <div className="lg:col-span-7 space-y-3 lg:h-full overflow-y-auto pr-1">
          {/* Project name - for create and edit */}
          <Card>
            <CardContent className="py-3">
              <label className="block text-xs font-medium text-zinc-500 mb-2">Project / Render name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={template.name}
                className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <p className="text-xs text-zinc-400 mt-1">Optional. Keeps your renders organized when you remix the same template many times.</p>
            </CardContent>
          </Card>

          {currentScene && (
            <Card className="hover:border-orange-500/50 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-orange-500/20 flex items-center justify-center text-xs font-bold text-orange-400 border border-orange-500/40">{activeScene + 1}</div>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-800">{currentScene.scene_name}</h2>
                    {currentScene && getSceneBackground(currentScene) && <p className="text-xs text-zinc-400">Has background video</p>}
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
                    <div className="h-8 w-8 rounded bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 border border-zinc-300">{si + 1}</div>
                    <div>
                      <p className="text-sm font-medium text-zinc-600">{scene.scene_name}</p>
                      <p className="text-xs text-zinc-400">{editableEls.length} editable elements</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <div className="flex flex-wrap gap-3 pb-4">
            {isEditMode ? (
              <>
                <Button onClick={() => handleSubmit(false)} loading={loading} variant="ghost">
                  Save Changes
                </Button>
                <Button onClick={() => handleSubmit(true)} loading={loading} variant="secondary">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Save & Re-render
                </Button>
              </>
            ) : (
              <Button onClick={() => handleSubmit(false)} loading={loading} variant="secondary">
                Generate Video
              </Button>
            )}
            <Button onClick={handleSaveAndPublish} loading={loading} className="flex-1">
              <Send className="h-4 w-4 mr-2" />
              Save and Publish
            </Button>
            {aiFields.length > 0 && (
              <Button variant="ghost" onClick={() => setShowAi(true)}>
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
