'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { getStatusColor, formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  Download,
  Play,
  Calendar,
  Pencil,
  Check,
  Trash2,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import type { Content, Platform } from '@/types';

export function ContentDetail({ content: initialContent }: { content: Content }) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedPlatform, setSchedPlatform] = useState<Platform>('instagram');
  const [schedTime, setSchedTime] = useState('');
  const [caption, setCaption] = useState('');
  const [schedLoading, setSchedLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(initialContent.name || initialContent.project?.name || initialContent.project?.template?.name || 'Untitled');
  const [nameLoading, setNameLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);

  const displayName = content.name || content.project?.name || content.project?.template?.name || 'Untitled';

  async function handleSaveName() {
    if (nameValue.trim() === (content.name ?? '')) {
      setEditingName(false);
      return;
    }
    setNameLoading(true);
    try {
      const res = await fetch(`/api/content/${content.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameValue.trim() || null }),
      });
      if (res.ok) {
        setContent((c) => ({ ...c, name: nameValue.trim() || null }));
        setEditingName(false);
      }
    } finally {
      setNameLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this content? The video file will remain in storage.')) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/content/${content.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/dashboard/content');
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete');
      }
    } catch {
      alert('Failed to delete');
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handlePostNow() {
    if (!content.project_id || !content.output_video_url) return;
    setPostLoading(true);
    try {
      const res = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: content.project_id,
          content_id: content.id,
          caption: caption.trim() || '',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Posted to Instagram!');
        router.refresh();
      } else {
        alert(data.error || 'Failed to post');
      }
    } catch {
      alert('Failed to post');
    } finally {
      setPostLoading(false);
    }
  }

  async function handleSchedule() {
    if (!schedTime || !content.project_id) return;
    setSchedLoading(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: content.project_id,
          content_id: content.id,
          platform: schedPlatform,
          scheduled_time: new Date(schedTime).toISOString(),
          caption: caption.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowSchedule(false);
        router.push('/dashboard/schedule');
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to schedule');
      }
    } catch {
      alert('Failed to schedule');
    } finally {
      setSchedLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/content">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  className="text-2xl font-bold text-zinc-900 border border-orange-500 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  autoFocus
                />
                <Button variant="ghost" size="sm" onClick={handleSaveName} loading={nameLoading}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-2xl font-bold text-zinc-900">{displayName}</h1>
                <button
                  type="button"
                  onClick={() => { setNameValue(displayName); setEditingName(true); }}
                  className="p-1 rounded text-zinc-400 hover:text-orange-500 hover:bg-orange-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Rename"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
            <p className="text-sm text-zinc-500 mt-0.5">
              Published {formatDate(content.created_at)}
              {content.project?.template && (
                <span className="ml-2">· Template: {content.project.template.name}</span>
              )}
            </p>
          </div>
        </div>
        <Badge className={`${getStatusColor(content.status)} text-sm px-3 py-1`}>
          {content.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-zinc-800">Final Render</h2>
            </CardHeader>
            <CardContent>
              {content.output_video_url ? (
                <video
                  src={content.output_video_url}
                  className="w-full rounded aspect-video bg-zinc-100"
                  controls
                  playsInline
                  muted={false}
                />
              ) : (
                <div className="w-full rounded aspect-video bg-zinc-100 flex flex-col items-center justify-center gap-3 border border-zinc-200">
                  <Play className="h-12 w-12 text-orange-500/50" />
                  <p className="text-sm text-zinc-500">
                    {content.status === 'rendering' || content.status === 'queued'
                      ? 'Your video is being rendered...'
                      : content.status === 'failed'
                        ? 'Rendering failed. Edit the project and try again.'
                        : 'No video yet'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="py-4 space-y-3">
              {content.output_video_url && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-zinc-500">Caption (optional)</label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Add a caption for Instagram..."
                      rows={2}
                      className="w-full rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:border-orange-500 focus:outline-none resize-none"
                    />
                  </div>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handlePostNow}
                    loading={postLoading}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Post to Instagram
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setShowSchedule(true)}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Post
                  </Button>
                  <a href={content.output_video_url} download className="block">
                    <Button variant="secondary" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Download Video
                    </Button>
                  </a>
                </>
              )}
              {content.project_id && (
                <Link href={`/dashboard/projects/${content.project_id}`}>
                  <Button variant="secondary" className="w-full">
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Template
                  </Button>
                </Link>
              )}
              <Button variant="danger" onClick={handleDelete} loading={deleteLoading} className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Details</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Status</dt>
                  <dd className="text-zinc-800 capitalize">{content.status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Template</dt>
                  <dd className="text-zinc-800">{content.project?.template?.name || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Created</dt>
                  <dd className="text-zinc-800">{formatDate(content.created_at)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal open={showSchedule} onClose={() => setShowSchedule(false)} title="Schedule Post">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700">Caption (optional)</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption for Instagram..."
              rows={2}
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:outline-none resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700">Platform</label>
            <select
              value={schedPlatform}
              onChange={(e) => setSchedPlatform(e.target.value as Platform)}
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none"
            >
              <option value="instagram">Instagram Reels</option>
              <option value="tiktok">TikTok</option>
            </select>
          </div>
          <Input
            id="scheduled_time"
            label="Scheduled Time"
            type="datetime-local"
            value={schedTime}
            onChange={(e) => setSchedTime(e.target.value)}
          />
          <Button onClick={handleSchedule} loading={schedLoading} className="w-full">
            Schedule
          </Button>
        </div>
      </Modal>
    </div>
  );
}
