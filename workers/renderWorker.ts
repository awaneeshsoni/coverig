import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

const QUEUE_NAME = 'video-render';

interface RenderJob {
  project_id: string;
  template_id: string;
  inputs_json: Record<string, string>;
}

interface SceneElement {
  type: 'text' | 'video_slot';
  label: string;
  editable: boolean;
  position?: 'top' | 'center' | 'bottom';
  fontSize?: number;
  fontColor?: string;
  default_value?: string;
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

async function verifyRedisConnection(): Promise<void> {
  const config = getRedisConfig();
  const client = new Redis({ host: config.host, port: config.port, password: config.password, lazyConnect: true });

  try {
    await client.connect();
    const pong = await client.ping();
    console.log(`[Worker] Redis connected at ${config.host}:${config.port} — PING=${pong}`);
  } catch (err) {
    console.error(`[Worker] FATAL: Cannot connect to Redis at ${config.host}:${config.port}`);
    console.error(`[Worker] Is Redis running? Try: docker compose up -d redis`);
    throw err;
  } finally {
    await client.quit();
  }
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`[Worker] FATAL: Missing environment variable ${name}`);
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

const WORK_DIR = join(process.cwd(), '.render-tmp');
const W = 1080;
const H = 1920;

async function updateProjectStatus(projectId: string, status: string, outputUrl?: string) {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (outputUrl) updates.output_video_url = outputUrl;
  const { error } = await supabase.from('projects').update(updates).eq('id', projectId);
  if (error) console.error(`[Worker] Failed to update project ${projectId} to ${status}:`, error.message);
  else console.log(`[Worker] Project ${projectId} status → ${status}`);
}

async function uploadToR2(filePath: string): Promise<string> {
  const key = `renders/${uuidv4()}.mp4`;
  const body = readFileSync(filePath);
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: 'video/mp4' }));
  return `${PUBLIC_URL}/${key}`;
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
  const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!resp.Body) throw new Error(`Empty response for R2 key: ${key}`);
  const bytes = await resp.Body.transformToByteArray();
  writeFileSync(dest, Buffer.from(bytes));
}

function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/;/g, '\\;');
}

function yPos(position?: string): string {
  if (position === 'top') return '(h*0.08)';
  if (position === 'bottom') return '(h-text_h-h*0.08)';
  return '(h-text_h)/2';
}

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`[Worker]   Downloading: ${url.substring(0, 80)}...`);

  const r2Key = extractR2Key(url);
  if (r2Key) {
    console.log(`[Worker]   Using S3 SDK for R2 key: ${r2Key}`);
    await downloadFromR2(r2Key, dest);
    return;
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
}

function elKey(sceneIdx: number, elIdx: number): string {
  return `scene_${sceneIdx}_el_${elIdx}`;
}

function ffmpeg(cmd: string, timeout = 120_000): void {
  try {
    execSync(`ffmpeg ${cmd}`, { timeout, stdio: 'pipe' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`FFmpeg failed: ${msg.substring(0, 300)}`);
  }
}

async function renderScene(
  scene: TemplateScene,
  sceneIdx: number,
  inputs: Record<string, string>,
  jobDir: string,
  outputPath: string
): Promise<void> {
  const dur = scene.duration || 5;

  console.log(`[Worker]   Scene ${sceneIdx}: "${scene.scene_name}" (${dur}s)`);

  const videoSlot = scene.elements.find((el, ei) => {
    if (el.type !== 'video_slot' || !el.editable) return false;
    return !!inputs[elKey(sceneIdx, ei)];
  });

  const videoSlotIdx = videoSlot ? scene.elements.indexOf(videoSlot) : -1;
  const videoSlotUrl = videoSlotIdx >= 0 ? inputs[elKey(sceneIdx, videoSlotIdx)] : undefined;

  let basePath: string;

  if (videoSlotUrl) {
    basePath = join(jobDir, `scene_${sceneIdx}_user.mp4`);
    await downloadFile(videoSlotUrl, basePath);
    const scaled = join(jobDir, `scene_${sceneIdx}_user_scaled.mp4`);
    ffmpeg(`-y -i "${basePath}" -t ${dur} -vf "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v libx264 -preset fast -crf 23 -an "${scaled}"`);
    basePath = scaled;
  } else if (scene.background_video) {
    basePath = join(jobDir, `scene_${sceneIdx}_bg.mp4`);
    await downloadFile(scene.background_video, basePath);
    const scaled = join(jobDir, `scene_${sceneIdx}_bg_scaled.mp4`);
    ffmpeg(`-y -i "${basePath}" -t ${dur} -vf "scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v libx264 -preset fast -crf 23 -an "${scaled}"`);
    basePath = scaled;
  } else {
    basePath = join(jobDir, `scene_${sceneIdx}_color.mp4`);
    ffmpeg(`-y -f lavfi -i "color=c=0x111111:s=${W}x${H}:d=${dur}" -c:v libx264 -preset fast -crf 23 "${basePath}"`, 30_000);
  }

  const textOverlays = scene.elements
    .map((el, ei) => ({ el, ei }))
    .filter(({ el, ei }) => {
      if (el.type !== 'text') return false;
      const key = elKey(sceneIdx, ei);
      const value = el.editable ? inputs[key] : el.default_value;
      return !!value;
    });

  if (textOverlays.length === 0) {
    if (basePath !== outputPath) {
      ffmpeg(`-y -i "${basePath}" -c copy "${outputPath}"`);
    }
    return;
  }

  const filterParts: string[] = [];
  let lastLabel = '0:v';

  textOverlays.forEach(({ el, ei }, i) => {
    const key = elKey(sceneIdx, ei);
    const text = el.editable ? (inputs[key] || '') : (el.default_value || '');
    const escaped = esc(text);
    const y = yPos(el.position);
    const fontSize = el.fontSize || 56;
    const fontColor = el.fontColor || 'white';
    const outLabel = `t${i}`;
    filterParts.push(
      `[${lastLabel}]drawtext=text='${escaped}':fontsize=${fontSize}:fontcolor=${fontColor}:x=(w-text_w)/2:y=${y}:shadowcolor=black:shadowx=2:shadowy=2[${outLabel}]`
    );
    lastLabel = outLabel;
  });

  ffmpeg(`-y -i "${basePath}" -filter_complex "${filterParts.join(';')}" -map "[${lastLabel}]" -c:v libx264 -preset fast -crf 23 "${outputPath}"`, 300_000);
}

async function processRenderJob(job: Job<RenderJob>) {
  const { project_id, template_id, inputs_json } = job.data;
  const jobDir = join(WORK_DIR, project_id);

  console.log(`\n[Worker] ========================================`);
  console.log(`[Worker] Job started: ${job.id}`);
  console.log(`[Worker] Project: ${project_id}`);
  console.log(`[Worker] Template: ${template_id}`);
  console.log(`[Worker] ========================================`);

  try {
    await updateProjectStatus(project_id, 'rendering');

    if (!existsSync(jobDir)) mkdirSync(jobDir, { recursive: true });

    const { data: template } = await supabase
      .from('templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (!template) throw new Error(`Template ${template_id} not found`);

    const config: TemplateConfig = template.config_json;
    const finalOutput = join(jobDir, 'output.mp4');
    const scenePaths: string[] = [];

    console.log(`[Worker] Template "${template.name}" — ${config.scenes.length} scenes`);

    for (let si = 0; si < config.scenes.length; si++) {
      const scenePath = join(jobDir, `rendered_scene_${si}.mp4`);
      await renderScene(config.scenes[si], si, inputs_json, jobDir, scenePath);
      if (existsSync(scenePath)) scenePaths.push(scenePath);
    }

    if (scenePaths.length === 0) throw new Error('No scenes produced output');

    if (scenePaths.length === 1) {
      ffmpeg(`-y -i "${scenePaths[0]}" -c copy "${finalOutput}"`);
    } else {
      const concatFile = join(jobDir, 'concat.txt');
      writeFileSync(concatFile, scenePaths.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
      ffmpeg(`-y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -preset fast -crf 23 "${finalOutput}"`, 300_000);
    }

    if (!existsSync(finalOutput)) throw new Error('FFmpeg did not produce an output file');

    console.log(`[Worker] Uploading to R2...`);
    const url = await uploadToR2(finalOutput);

    await updateProjectStatus(project_id, 'completed', url);
    console.log(`[Worker] ✓ Job completed: ${job.id} → ${url}`);
  } catch (error) {
    console.error(`[Worker] ✗ Render failed for ${project_id}:`, error);
    await updateProjectStatus(project_id, 'failed');
    throw error;
  } finally {
    try {
      if (existsSync(jobDir)) rmSync(jobDir, { recursive: true, force: true });
    } catch {
      // cleanup failure is non-critical
    }
  }
}

async function main() {
  console.log(`[Worker] Starting render worker...`);
  console.log(`[Worker] Queue: ${QUEUE_NAME}`);

  await verifyRedisConnection();

  const redisConfig = getRedisConfig();
  const worker = new Worker<RenderJob>(QUEUE_NAME, processRenderJob, {
    connection: redisConfig,
    concurrency: 2,
    limiter: { max: 5, duration: 60_000 },
  });

  worker.on('ready', () => {
    console.log(`[Worker] Worker ready — listening on "${QUEUE_NAME}"`);
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] ✓ Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] ✗ Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[Worker] Job ${jobId} stalled — will be retried`);
  });

  console.log(`[Worker] Worker initialized — waiting for jobs...`);

  const shutdown = async (signal: string) => {
    console.log(`\n[Worker] ${signal} received — shutting down gracefully...`);
    await worker.close();
    console.log(`[Worker] Worker closed.`);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[Worker] Failed to start worker:', err);
  process.exit(1);
});
