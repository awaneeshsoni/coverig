export type ScheduleStatus = 'pending' | 'posted' | 'failed';
export type Platform = 'instagram' | 'tiktok';
export type UserRole = 'user' | 'moderator' | 'admin';
export type TemplateStatus = 'draft' | 'processing' | 'published' | 'rejected';

export type TextPosition = 'top' | 'center' | 'bottom';
export type ElementType = 'text' | 'video' | 'image';

export type FontFamily = 'Arial' | 'Impact' | 'Georgia' | 'Courier New' | 'Verdana' | 'Times New Roman' | 'Comic Sans MS';

export const FONT_FAMILIES: FontFamily[] = [
  'Arial', 'Impact', 'Georgia', 'Courier New', 'Verdana', 'Times New Roman', 'Comic Sans MS',
];

export const COLOR_SWATCHES = [
  '#ffffff', '#000000', '#f97316', '#ef4444', '#3b82f6', '#eab308', '#22c55e', '#a855f7', '#ec4899',
];

export interface SceneElement {
  type: ElementType;
  label: string;
  editable: boolean;
  position?: TextPosition;
  ai_suggest?: boolean;
  default_value?: string;
  fontSize?: number;
  fontColor?: string;
  fontFamily?: FontFamily;
  fontWeight?: 'normal' | 'bold';
  dropShadow?: boolean;
  shadowColor?: string;
  shadowX?: number;
  shadowY?: number;
  opacity?: number;
  borderRadius?: number;
  objectFit?: 'cover' | 'contain';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  src?: string;
}

export interface TemplateScene {
  scene_name: string;
  background_video?: string;
  duration?: number;
  elements: SceneElement[];
}

export interface TemplateConfig {
  scenes: TemplateScene[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  preview_video_url: string | null;
  config_json: TemplateConfig;
  status: TemplateStatus;
  creator_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface TemplatePreviewJob {
  template_id: string;
}

export interface Project {
  id: string;
  user_id: string;
  template_id: string;
  name: string | null;
  inputs_json: Record<string, string>;
  output_video_url: string | null;
  created_at: string;
  updated_at: string;
  template?: Template;
}

export type ContentStatus = 'queued' | 'rendering' | 'completed' | 'failed';

export interface Content {
  id: string;
  user_id: string;
  project_id: string;
  name: string | null;
  output_video_url: string | null;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
  project?: Project;
}

export interface ScheduledPost {
  id: string;
  user_id: string;
  project_id: string;
  content_id?: string | null;
  caption?: string | null;
  platform: Platform;
  scheduled_time: string;
  status: ScheduleStatus;
  created_at: string;
  project?: Project;
  content?: { id: string; name: string | null; output_video_url: string | null; status: ContentStatus } | null;
}

export interface User {
  id: string;
  email: string;
}

export interface RenderJob {
  project_id: string;
  template_id: string;
  inputs_json: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

export type PlanType = 'free' | 'starter' | 'creator' | 'agency';

export interface InstagramAccount {
  id: string;
  user_id: string;
  instagram_user_id: string;
  username: string;
  access_token: string;
  token_expiry: string | null;
  created_at: string;
  updated_at: string;
}

export type InstagramPostStatus = 'pending' | 'uploading' | 'published' | 'failed';

export interface InstagramPost {
  id: string;
  user_id: string;
  project_id: string;
  instagram_media_id: string | null;
  caption: string | null;
  status: InstagramPostStatus;
  posted_at: string | null;
  created_at: string;
  project?: Project;
}

export interface InstagramAnalytics {
  id: string;
  post_id: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: PlanType;
  lemon_squeezy_id: string | null;
  lemon_squeezy_status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  renders_used: number;
  renders_limit: number;
  created_at: string;
  updated_at: string;
}

export const PLAN_LIMITS: Record<PlanType, { renders: number; label: string; price: string }> = {
  free: { renders: 10, label: 'Free', price: '$0/mo' },
  starter: { renders: 100, label: 'Starter', price: '$19/mo' },
  creator: { renders: 500, label: 'Creator', price: '$49/mo' },
  agency: { renders: 2000, label: 'Agency', price: '$149/mo' },
};

export type MediaFileType = 'video' | 'image';
export type MediaCategory = 'backgrounds' | 'overlays' | 'clips' | 'logos' | 'other';

export const MEDIA_CATEGORIES: { value: MediaCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'backgrounds', label: 'Backgrounds' },
  { value: 'overlays', label: 'Overlays' },
  { value: 'clips', label: 'Clips' },
  { value: 'logos', label: 'Logos' },
  { value: 'other', label: 'Other' },
];

export interface MediaAsset {
  id: string;
  uploader_id: string | null;
  url: string;
  filename: string | null;
  file_type: MediaFileType;
  content_type: string | null;
  file_size: number | null;
  category: MediaCategory;
  tags: string[];
  thumbnail_url: string | null;
  created_at: string;
}
