import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

// ── Config ───────────────────────────────────────────────────────────────────

const PREVIEW_QUEUE = 'template-preview-render';
const RENDER_QUEUE = 'video-render';
const POLL_INTERVAL_MS = 10_000;

interface SceneElement {
  type: 'text' | 'video_slot' | 'video' | 'image';
  label: string;
  editable: boolean;
  position?: 'top' | 'center' | 'bottom';
  fontSize?: number;
  fontColor?: string;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  dropShadow?: boolean;
  shadowColor?: string;
  shadowX?: number;
  shadowY?: number;
  opacity?: number;
  borderRadius?: number;
  objectFit?: 'cover' | 'contain';
  default_value?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  src?: string;
}

interface TemplateScene {
  scene_name: string;
  background_video?: string;
  duration?: number;
  elements: SceneElement[];
}

interface TemplateConfig {
  scenes: TemplateScene[];
}

function getRedisConfig() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
  };
}

async function verifyRedisConnection(): Promise<boolean> {
  const config = getRedisConfig();
  const client = new Redis({ host: config.host, port: config.port, password: config.password, lazyConnect: true });
  try {
    await client.connect();
    const pong = await client.ping();
    console.log(`[Worker] Redis OK at ${config.host}:${config.port} — PING=${pong}`);
    return true;
  } catch {
    console.warn(`[Worker] Redis unavailable — falling back to DB polling only`);
    return false;
  } finally {
    await client.quit().catch(() => {});
  }
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`FATAL: Missing env var ${name}`);
  return val;
}

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const r2AccountId = requireEnv('CLOUDFLARE_R2_ACCOUNT_ID');
const r2AccessKey = requireEnv('CLOUDFLARE_R2_ACCESS_KEY_ID');
const r2SecretKey = requireEnv('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
const BUCKET = requireEnv('CLOUDFLARE_R2_BUCKET_NAME');
const PUBLIC_URL = requireEnv('CLOUDFLARE_R2_PUBLIC_URL');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: r2AccessKey, secretAccessKey: r2SecretKey },
});

const WORK_DIR = join(process.cwd(), '.worker-tmp');
const W = 1080;
const H = 1920;

if (!existsSync(WORK_DIR)) mkdirSync(WORK_DIR, { recursive: true });

// ── Shared helpers ───────────────────────────────────────────────────────────

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function extractR2Key(url: string): string | null {
  const s3WithBucket = `https://${r2AccountId}.r2.cloudflarestorage.com/${BUCKET}/`;
  if (url.startsWith(s3WithBucket)) return url.slice(s3WithBucket.length);
  const s3NoBucket = `https://${r2AccountId}.r2.cloudflarestorage.com/`;
  if (url.startsWith(s3NoBucket)) return url.slice(s3NoBucket.length);
  const publicPrefix = `${PUBLIC_URL}/`;
  if (url.startsWith(publicPrefix)) return url.slice(publicPrefix.length);
  return null;
}

async function downloadFromR2(key: string, dest: string): Promise<void> {
  const dir = join(dest, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!resp.Body) throw new Error(`Empty R2 response: ${key}`);
  const bytes = await resp.Body.transformToByteArray();
  writeFileSync(dest, Buffer.from(bytes));
  console.log(`[Worker]   Downloaded ${(bytes.length / 1024 / 1024).toFixed(1)}MB → ${dest.split(/[/\\]/).pop()}`);
}

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`[Worker]   Downloading: ${url.substring(0, 80)}...`);
  const r2Key = extractR2Key(url);
  if (r2Key) {
    await downloadFromR2(r2Key, dest);
    return;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

async function uploadToR2(filePath: string, folder: string): Promise<string> {
  const key = `${folder}/${uuidv4()}.mp4`;
  const body = readFileSync(filePath);
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: 'video/mp4' }));
  return `${PUBLIC_URL}/${key}`;
}

function esc(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:')
    .replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/;/g, '\\;');
}

function yPos(position?: string): string {
  if (position === 'top') return '(h*0.08)';
  if (position === 'bottom') return '(h-text_h-h*0.08)';
  return '(h-text_h)/2';
}

function buildSingleDrawtext(lineText: string, el: Partial<SceneElement>, yExpr: string, xExpr?: string): string {
  const fs = el.fontSize || 56;
  const fc = el.fontColor || 'white';
  const x = xExpr || '(w-text_w)/2';
  const font = el.fontFamily || 'Arial';
  let dt = `drawtext=text='${lineText}':fontsize=${fs}:fontcolor=${fc}:font='${font}':x=${x}:y=${yExpr}`;
  if (el.dropShadow !== false) {
    const sx = el.shadowX ?? 2;
    const sy = el.shadowY ?? 2;
    const sc = el.shadowColor ? el.shadowColor.replace('#', '0x') : 'black';
    dt += `:shadowcolor=${sc}:shadowx=${sx}:shadowy=${sy}`;
  }
  if (el.opacity != null && el.opacity < 1) {
    dt += `:alpha=${el.opacity}`;
  }
  return dt;
}

function buildDrawtextLines(
  rawText: string, el: Partial<SceneElement>, baseYExpr: string,
  xExpr: string | undefined, lastStream: string, overlayFilters: string[], labelPrefix: string
): string {
  const lines = rawText.split(/\\n|\n/).filter((l) => l.length > 0);
  if (lines.length <= 1) {
    const lbl = `${labelPrefix}`;
    overlayFilters.push(`[${lastStream}]${buildSingleDrawtext(esc(rawText), el, baseYExpr, xExpr)}[${lbl}]`);
    return lbl;
  }
  const fs = el.fontSize || 56;
  const lineHeight = Math.round(fs * 1.3);
  let cur = lastStream;
  for (let li = 0; li < lines.length; li++) {
    const lbl = `${labelPrefix}_${li}`;
    const yOff = `${baseYExpr}+${li * lineHeight}`;
    overlayFilters.push(`[${cur}]${buildSingleDrawtext(esc(lines[li]), el, yOff, xExpr)}[${lbl}]`);
    cur = lbl;
  }
  return cur;
}

function ffmpeg(cmd: string, timeout = 120_000): void {
  try {
    execSync(`ffmpeg ${cmd}`, { timeout, stdio: 'pipe' });
  } catch (err: unknown) {
    const stderr = (err as { stderr?: Buffer })?.stderr?.toString().slice(-500) || '';
    const msg = err instanceof Error ? err.message.substring(0, 200) : String(err);
    throw new Error(`FFmpeg failed: ${msg}\nstderr: ${stderr}`);
  }
}

function validateConfig(config: TemplateConfig): string | null {
  if (!config?.scenes || !Array.isArray(config.scenes) || config.scenes.length === 0) {
    return 'config must have at least one scene';
  }
  for (const scene of config.scenes) {
    if (!scene.scene_name) return 'Each scene must have a scene_name';
    if (!Array.isArray(scene.elements)) return `Scene "${scene.scene_name}" must have elements array`;
  }
  return null;
}

function elKey(sceneIdx: number, elIdx: number): string {
  return `scene_${sceneIdx}_el_${elIdx}`;
}

function getEffectiveElement(el: SceneElement, si: number, ei: number, inputs: Record<string, unknown>): SceneElement {
  const raw = inputs[`${elKey(si, ei)}_style`];
  if (raw == null) return el;
  let parsed: Record<string, unknown>;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw) as Record<string, unknown>; } catch { return el; }
  } else if (typeof raw === 'object' && raw !== null) {
    parsed = raw as Record<string, unknown>;
  } else return el;
  return { ...el, ...parsed } as SceneElement;
}

const activeJobs = new Set<string>();

function cleanupDir(dir: string) {
  try { if (existsSync(dir)) rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1: TEMPLATE PREVIEW RENDERING (moderator flow)
// ══════════════════════════════════════════════════════════════════════════════

async function updateTemplateStatus(id: string, status: string, previewUrl?: string) {
  const updates: Record<string, unknown> = { status };
  if (previewUrl) updates.preview_video_url = previewUrl;
  const { error } = await supabase.from('templates').update(updates).eq('id', id);
  if (error) console.error(`[Preview] DB update failed for ${id}:`, error.message);
  else console.log(`[Preview] Template ${id} → ${status}`);
}

async function renderPreviewScene(scene: TemplateScene, si: number, jobDir: string, out: string) {
  const dur = scene.duration || 4;
  let basePath: string;

  console.log(`[Preview]   Scene ${si}: "${scene.scene_name}" (${dur}s)`);

  if (scene.background_video) {
    basePath = join(jobDir, `s${si}_bg.mp4`);
    await downloadFile(scene.background_video, basePath);
    const scaled = join(jobDir, `s${si}_bg_s.mp4`);
    ffmpeg(`-y -i "${normalizePath(basePath)}" -t ${dur} -vf "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${normalizePath(scaled)}"`);
    basePath = scaled;
  } else {
    basePath = join(jobDir, `s${si}_color.mp4`);
    const color = scene.elements.some((e) => e.type === 'video_slot') ? '0x333333' : '0x1a1a1a';
    ffmpeg(`-y -f lavfi -i "color=c=${color}:s=${W}x${H}:d=${dur}" -f lavfi -i "anullsrc=r=44100:cl=stereo" -t ${dur} -c:v libx264 -preset fast -crf 23 -c:a aac -shortest "${normalizePath(basePath)}"`, 30_000);
  }

  const overlayInputs: string[] = [];
  const overlayFilters: string[] = [];
  let inputIdx = 1;
  let lastStream = '0:v';

  for (const el of scene.elements) {
    if ((el.type === 'image' || el.type === 'video') && el.src) {
      const ext = el.type === 'image' ? 'png' : 'mp4';
      const assetPath = join(jobDir, `s${si}_overlay_${inputIdx}.${ext}`);
      await downloadFile(el.src, assetPath);

      const ow = Math.round(W * (el.width || 25) / 100);
      const oh = Math.round(H * (el.height || 15) / 100);
      const ox = Math.round(W * (el.x || 0) / 100);
      const oy = Math.round(H * (el.y || 0) / 100);

      overlayInputs.push(`-i "${normalizePath(assetPath)}"`);
      const scaleLabel = `ovs${inputIdx}`;
      const outLabel = `ov${inputIdx}`;

      if (el.type === 'image') {
        overlayFilters.push(`[${inputIdx}:v]scale=${ow}:${oh}[${scaleLabel}]`);
      } else {
        overlayFilters.push(`[${inputIdx}:v]scale=${ow}:${oh},setsar=1[${scaleLabel}]`);
      }
      overlayFilters.push(`[${lastStream}][${scaleLabel}]overlay=${ox}:${oy}:shortest=1[${outLabel}]`);
      lastStream = outLabel;
      inputIdx++;
    }
  }

  let dtIdx = 0;
  {
    const o = `dtxt${dtIdx++}`;
    overlayFilters.push(`[${lastStream}]${buildSingleDrawtext(esc(scene.scene_name), { fontSize: 36, fontColor: 'gray', dropShadow: true }, '(h*0.04)')}[${o}]`);
    lastStream = o;
  }
  scene.elements.forEach((el) => {
    if (el.type === 'text') {
      const ty = el.y !== undefined ? `(h*${el.y / 100})` : yPos(el.position);
      const lbl = `dtxt${dtIdx++}`;
      lastStream = buildDrawtextLines(`[${el.label}]`, el, ty, undefined, lastStream, overlayFilters, lbl);
    } else if (el.type === 'video_slot') {
      const ty = el.y !== undefined ? `(h*${el.y / 100})` : '(h-text_h)/2';
      const o = `dtxt${dtIdx++}`;
      overlayFilters.push(`[${lastStream}]${buildSingleDrawtext(esc(`[Upload\\: ${el.label}]`), { fontSize: 42, fontColor: 'orange', dropShadow: true }, ty)}[${o}]`);
      lastStream = o;
    }
  });

  if (overlayFilters.length === 0) {
    ffmpeg(`-y -i "${normalizePath(basePath)}" -c copy "${normalizePath(out)}"`);
    return;
  }

  const inputArgs = overlayInputs.join(' ');
  ffmpeg(`-y -i "${normalizePath(basePath)}" ${inputArgs} -filter_complex "${overlayFilters.join(';')}" -map "[${lastStream}]" -map 0:a? -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${normalizePath(out)}"`);
}

async function processPreview(templateId: string, source: string) {
  if (activeJobs.has(`preview:${templateId}`)) return;
  activeJobs.add(`preview:${templateId}`);
  const jobDir = join(WORK_DIR, `preview-${templateId}`);

  console.log(`\n[Preview] ═══ Template: ${templateId} (${source}) ═══`);

  try {
    if (!existsSync(jobDir)) mkdirSync(jobDir, { recursive: true });

    const { data: template, error } = await supabase.from('templates').select('*').eq('id', templateId).single();
    if (error || !template) throw new Error(`Template not found: ${error?.message}`);

    const config: TemplateConfig = template.config_json;
    console.log(`[Preview] "${template.name}" — ${config.scenes?.length || 0} scenes`);

    const valErr = validateConfig(config);
    if (valErr) { console.error(`[Preview] Invalid: ${valErr}`); await updateTemplateStatus(templateId, 'rejected'); return; }

    const finalOut = join(jobDir, 'preview.mp4');
    const scenePaths: string[] = [];

    for (let si = 0; si < config.scenes.length; si++) {
      const sp = join(jobDir, `ps_${si}.mp4`);
      await renderPreviewScene(config.scenes[si], si, jobDir, sp);
      if (existsSync(sp)) scenePaths.push(sp);
    }

    if (scenePaths.length === 0) throw new Error('No scenes produced');

    if (scenePaths.length === 1) {
      ffmpeg(`-y -i "${normalizePath(scenePaths[0])}" -c copy "${normalizePath(finalOut)}"`);
    } else {
      const cf = join(jobDir, 'concat.txt');
      writeFileSync(cf, scenePaths.map((p) => `file '${normalizePath(p)}'`).join('\n'));
      ffmpeg(`-y -f concat -safe 0 -i "${normalizePath(cf)}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${normalizePath(finalOut)}"`, 300_000);
    }

    if (!existsSync(finalOut)) throw new Error('FFmpeg produced no output');

    console.log(`[Preview] Uploading to R2...`);
    const url = await uploadToR2(finalOut, 'previews');
    await updateTemplateStatus(templateId, 'published', url);
    console.log(`[Preview] DONE → ${url}`);
  } catch (err) {
    console.error(`[Preview] FAILED:`, err);
    await updateTemplateStatus(templateId, 'rejected');
  } finally {
    activeJobs.delete(`preview:${templateId}`);
    cleanupDir(jobDir);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2: PROJECT RENDERING (user flow)
// ══════════════════════════════════════════════════════════════════════════════

async function updateProjectStatus(projectId: string, status: string, outputUrl?: string) {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (outputUrl) updates.output_video_url = outputUrl;
  const { error } = await supabase.from('projects').update(updates).eq('id', projectId);
  if (error) console.error(`[Render] DB update failed for ${projectId}:`, error.message);
  else console.log(`[Render] Project ${projectId} → ${status}`);
}

async function renderScene(scene: TemplateScene, si: number, inputs: Record<string, string>, jobDir: string, out: string) {
  const dur = scene.duration || 5;
  console.log(`[Render]   Scene ${si}: "${scene.scene_name}" (${dur}s)`);

  const videoSlot = scene.elements.find((el, ei) => el.type === 'video_slot' && el.editable && !!inputs[elKey(si, ei)]);
  const videoSlotIdx = videoSlot ? scene.elements.indexOf(videoSlot) : -1;
  const videoSlotUrl = videoSlotIdx >= 0 ? inputs[elKey(si, videoSlotIdx)] : undefined;

  let basePath: string;

  if (videoSlotUrl) {
    basePath = join(jobDir, `s${si}_user.mp4`);
    await downloadFile(videoSlotUrl, basePath);
    const scaled = join(jobDir, `s${si}_user_s.mp4`);
    ffmpeg(`-y -i "${normalizePath(basePath)}" -t ${dur} -vf "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${normalizePath(scaled)}"`);
    basePath = scaled;
  } else if (scene.background_video) {
    basePath = join(jobDir, `s${si}_bg.mp4`);
    await downloadFile(scene.background_video, basePath);
    const scaled = join(jobDir, `s${si}_bg_s.mp4`);
    ffmpeg(`-y -i "${normalizePath(basePath)}" -t ${dur} -vf "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${normalizePath(scaled)}"`);
    basePath = scaled;
  } else {
    basePath = join(jobDir, `s${si}_color.mp4`);
    ffmpeg(`-y -f lavfi -i "color=c=0x111111:s=${W}x${H}:d=${dur}" -f lavfi -i "anullsrc=r=44100:cl=stereo" -t ${dur} -c:v libx264 -preset fast -crf 23 -c:a aac -shortest "${normalizePath(basePath)}"`, 30_000);
  }

  const overlayInputs: string[] = [];
  const overlayFilters: string[] = [];
  let inputIdx = 1;
  let lastStream = '0:v';

  for (let ei = 0; ei < scene.elements.length; ei++) {
    const el = getEffectiveElement(scene.elements[ei], si, ei, inputs as Record<string, unknown>);
    if (el.type !== 'video' && el.type !== 'image') continue;

    const assetUrl = el.editable ? (inputs[elKey(si, ei)] || el.src) : el.src;
    if (!assetUrl) continue;

    const ext = el.type === 'image' ? 'png' : 'mp4';
    const assetPath = join(jobDir, `s${si}_asset_${ei}.${ext}`);
    await downloadFile(assetUrl, assetPath);

    const ow = Math.round(W * (el.width || 25) / 100);
    const oh = Math.round(H * (el.height || 15) / 100);
    const ox = Math.round(W * (el.x ?? 0) / 100);
    const oy = Math.round(H * (el.y ?? 0) / 100);

    overlayInputs.push(`-i "${normalizePath(assetPath)}"`);
    const scaleLabel = `as${inputIdx}`;
    const outLabel = `ao${inputIdx}`;

    if (el.type === 'image') {
      overlayFilters.push(`[${inputIdx}:v]scale=${ow}:${oh}[${scaleLabel}]`);
    } else {
      overlayFilters.push(`[${inputIdx}:v]scale=${ow}:${oh},setsar=1[${scaleLabel}]`);
    }
    overlayFilters.push(`[${lastStream}][${scaleLabel}]overlay=${ox}:${oy}:shortest=1[${outLabel}]`);
    lastStream = outLabel;
    inputIdx++;
  }

  const textOverlays = scene.elements
    .map((el, ei) => ({ el: getEffectiveElement(el, si, ei, inputs as Record<string, unknown>), ei }))
    .filter(({ el, ei }) => el.type === 'text' && !!(el.editable ? inputs[elKey(si, ei)] : el.default_value));

  textOverlays.forEach(({ el, ei }, i) => {
    const rawText = el.editable ? (inputs[elKey(si, ei)] || '') : (el.default_value || '');
    const ty = el.y != null ? `(h*${el.y / 100})` : yPos(el.position);
    const tx = el.x != null ? `(w*${el.x / 100})` : undefined;
    const lbl = `rt${i}`;
    lastStream = buildDrawtextLines(rawText, el, ty, tx, lastStream, overlayFilters, lbl);
  });

  if (overlayFilters.length === 0) {
    if (basePath !== out) ffmpeg(`-y -i "${normalizePath(basePath)}" -c copy "${normalizePath(out)}"`);
    return;
  }

  const inputArgs = overlayInputs.join(' ');
  ffmpeg(`-y -i "${normalizePath(basePath)}" ${inputArgs} -filter_complex "${overlayFilters.join(';')}" -map "[${lastStream}]" -map 0:a? -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${normalizePath(out)}"`, 300_000);
}

async function processRender(projectId: string, templateId: string, inputsJson: Record<string, string>, source: string) {
  if (activeJobs.has(`render:${projectId}`)) return;
  activeJobs.add(`render:${projectId}`);
  const jobDir = join(WORK_DIR, `render-${projectId}`);

  console.log(`\n[Render] ═══ Project: ${projectId} (${source}) ═══`);

  try {
    await updateProjectStatus(projectId, 'rendering');
    if (!existsSync(jobDir)) mkdirSync(jobDir, { recursive: true });

    const { data: template } = await supabase.from('templates').select('*').eq('id', templateId).single();
    if (!template) throw new Error(`Template ${templateId} not found`);

    const config: TemplateConfig = template.config_json;
    console.log(`[Render] Template "${template.name}" — ${config.scenes?.length || 0} scenes`);

    if (!config?.scenes?.length) throw new Error('Template has no scenes');

    const finalOut = join(jobDir, 'output.mp4');
    const scenePaths: string[] = [];

    for (let si = 0; si < config.scenes.length; si++) {
      const sp = join(jobDir, `rs_${si}.mp4`);
      await renderScene(config.scenes[si], si, inputsJson, jobDir, sp);
      if (existsSync(sp)) scenePaths.push(sp);
    }

    if (scenePaths.length === 0) throw new Error('No scenes produced');

    if (scenePaths.length === 1) {
      ffmpeg(`-y -i "${normalizePath(scenePaths[0])}" -c copy "${normalizePath(finalOut)}"`);
    } else {
      const cf = join(jobDir, 'concat.txt');
      writeFileSync(cf, scenePaths.map((p) => `file '${normalizePath(p)}'`).join('\n'));
      ffmpeg(`-y -f concat -safe 0 -i "${normalizePath(cf)}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${normalizePath(finalOut)}"`, 300_000);
    }

    if (!existsSync(finalOut)) throw new Error('FFmpeg produced no output');

    console.log(`[Render] Uploading to R2...`);
    const url = await uploadToR2(finalOut, 'renders');
    await updateProjectStatus(projectId, 'completed', url);
    console.log(`[Render] DONE → ${url}`);
  } catch (err) {
    console.error(`[Render] FAILED:`, err);
    await updateProjectStatus(projectId, 'failed');
  } finally {
    activeJobs.delete(`render:${projectId}`);
    cleanupDir(jobDir);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DB POLLING: picks stuck items from the database
// ══════════════════════════════════════════════════════════════════════════════

async function poll() {
  try {
    const { data: templates } = await supabase
      .from('templates').select('id, name').eq('status', 'processing')
      .order('created_at', { ascending: true }).limit(5);

    if (templates?.length) {
      console.log(`[Poll] ${templates.length} template(s) with status "processing"`);
      for (const t of templates) await processPreview(t.id, 'db-poll');
    }

    const { data: projects } = await supabase
      .from('projects').select('id, template_id, inputs_json, status')
      .in('status', ['queued', 'rendering'])
      .order('created_at', { ascending: true }).limit(5);

    if (projects?.length) {
      console.log(`[Poll] ${projects.length} project(s) with status "queued"/"rendering"`);
      for (const p of projects) await processRender(p.id, p.template_id, p.inputs_json || {}, 'db-poll');
    }
  } catch (err) {
    console.error('[Poll] Error:', (err as Error).message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`[Worker] Starting unified worker...`);
  console.log(`[Worker] Queues: ${PREVIEW_QUEUE}, ${RENDER_QUEUE}`);
  console.log(`[Worker] DB poll interval: ${POLL_INTERVAL_MS / 1000}s`);

  const redisOk = await verifyRedisConnection();
  const workers: Worker[] = [];

  if (redisOk) {
    const cfg = getRedisConfig();

    const previewWorker = new Worker(PREVIEW_QUEUE,
      async (job: Job<{ template_id: string }>) => { await processPreview(job.data.template_id, `queue:${job.id}`); },
      { connection: cfg, concurrency: 1, limiter: { max: 3, duration: 60_000 } }
    );
    previewWorker.on('ready', () => console.log(`[Worker] BullMQ listening: ${PREVIEW_QUEUE}`));
    previewWorker.on('failed', (job, err) => console.error(`[Worker] Queue job ${job?.id} failed: ${err.message}`));
    previewWorker.on('error', (err) => console.error(`[Worker] BullMQ error: ${err.message}`));
    workers.push(previewWorker);

    const renderWorker = new Worker(RENDER_QUEUE,
      async (job: Job<{ project_id: string; template_id: string; inputs_json: Record<string, string> }>) => {
        await processRender(job.data.project_id, job.data.template_id, job.data.inputs_json, `queue:${job.id}`);
      },
      { connection: cfg, concurrency: 1, limiter: { max: 3, duration: 60_000 } }
    );
    renderWorker.on('ready', () => console.log(`[Worker] BullMQ listening: ${RENDER_QUEUE}`));
    renderWorker.on('failed', (job, err) => console.error(`[Worker] Queue job ${job?.id} failed: ${err.message}`));
    renderWorker.on('error', (err) => console.error(`[Worker] BullMQ error: ${err.message}`));
    workers.push(renderWorker);
  }

  console.log(`[Worker] Running initial poll...`);
  await poll();

  const pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  console.log(`[Worker] Ready — queues + DB poll every ${POLL_INTERVAL_MS / 1000}s\n`);

  const shutdown = async (sig: string) => {
    console.log(`\n[Worker] ${sig} — shutting down...`);
    clearInterval(pollTimer);
    for (const w of workers) await w.close();
    console.log(`[Worker] Done.`);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => { console.error('[Worker] Fatal:', err); process.exit(1); });
