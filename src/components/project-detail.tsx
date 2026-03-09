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
  Trash2,
  Play,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import type { Project, Platform } from '@/types';

export function ProjectDetail({ project: initialProject }: { project: Project }) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [renderLoading, setRenderLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedPlatform, setSchedPlatform] = useState<Platform>('instagram');
  const [schedTime, setSchedTime] = useState('');
  const [schedLoading, setSchedLoading] = useState(false);

  async function handleRender() {
    setRenderLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/render`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setProject((p) => ({ ...p, status: 'queued' }));
      } else {
        alert(data.error || 'Failed to queue render');
      }
    } catch {
      alert('Failed to queue render');
    } finally {
      setRenderLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this project?')) return;
    setDeleteLoading(true);
    try {
      await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      router.push('/dashboard/projects');
    } catch {
      alert('Failed to delete project');
      setDeleteLoading(false);
    }
  }

  async function handleSchedule() {
    if (!schedTime) return;
    setSchedLoading(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          platform: schedPlatform,
          scheduled_time: new Date(schedTime).toISOString(),
        }),
      });
      if (res.ok) {
        setShowSchedule(false);
        router.refresh();
      }
    } catch {
      alert('Failed to schedule');
    } finally {
      setSchedLoading(false);
    }
  }

  const canRender = project.status === 'draft' || project.status === 'failed';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">
              {project.template?.name || 'Project'}
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Created {formatDate(project.created_at)}
            </p>
          </div>
        </div>
        <Badge className={`${getStatusColor(project.status)} text-sm px-3 py-1`}>
          {project.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-zinc-800">Video Output</h2>
            </CardHeader>
            <CardContent>
              {project.output_video_url ? (
                <video
                  src={project.output_video_url}
                  className="w-full rounded-lg aspect-video bg-zinc-100"
                  controls
                  playsInline
                  muted={false}
                />
              ) : (
                <div className="w-full rounded-lg aspect-video bg-zinc-100 flex flex-col items-center justify-center gap-3">
                  <Play className="h-12 w-12 text-zinc-400" />
                  <p className="text-sm text-zinc-500">
                    {project.status === 'rendering' || project.status === 'queued'
                      ? 'Your video is being rendered...'
                      : 'No video rendered yet'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-zinc-800">Inputs</h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(project.inputs_json).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{key}</p>
                    {typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://')) ? (
                      <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-500 hover:text-orange-600 truncate block">
                        {value}
                      </a>
                    ) : (
                      <p className="text-sm text-zinc-800">{value}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="py-4 space-y-3">
              {canRender && (
                <Button onClick={handleRender} loading={renderLoading} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {project.status === 'failed' ? 'Retry Render' : 'Start Render'}
                </Button>
              )}
              {project.output_video_url && (
                <>
                  <a href={project.output_video_url} download className="block">
                    <Button variant="secondary" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Download Video
                    </Button>
                  </a>
                  <Button variant="secondary" className="w-full" onClick={() => setShowSchedule(true)}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Post
                  </Button>
                </>
              )}
              <Button variant="danger" onClick={handleDelete} loading={deleteLoading} className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Project
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Details</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Template</dt>
                  <dd className="text-zinc-800">{project.template?.name || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Status</dt>
                  <dd className="text-zinc-800 capitalize">{project.status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Created</dt>
                  <dd className="text-zinc-800">{formatDate(project.created_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Updated</dt>
                  <dd className="text-zinc-800">{formatDate(project.updated_at)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal open={showSchedule} onClose={() => setShowSchedule(false)} title="Schedule Post">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700">Platform</label>
            <select
              value={schedPlatform}
              onChange={(e) => setSchedPlatform(e.target.value as Platform)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-orange-500 focus:outline-none"
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
