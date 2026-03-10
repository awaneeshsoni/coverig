import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { getStatusColor } from '@/lib/utils';
import { ScheduleTime } from '@/components/schedule-time';
import { Calendar, Instagram } from 'lucide-react';
import Link from 'next/link';
import type { ScheduledPost } from '@/types';
import { ScheduleActions } from '@/components/schedule-actions';

export default async function SchedulePage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: posts } = await supabase
    .from('scheduled_posts')
    .select('*, project:projects(*, template:templates(*)), content:content(id,name,output_video_url,status)')
    .eq('user_id', user!.id)
    .order('scheduled_time', { ascending: true });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Schedule</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your scheduled posts</p>
      </div>

      {(!posts || posts.length === 0) ? (
        <EmptyState
          icon={Calendar}
          title="No scheduled posts"
          description="Schedule a post from a completed project to get started."
        />
      ) : (
        <div className="grid gap-4">
          {(posts as ScheduledPost[]).map((post) => (
            <Card key={post.id} className="hover:border-orange-500/50 transition-colors">
              <CardContent className="flex items-center gap-4 py-4">
                {post.content?.output_video_url ? (
                  <div className="h-12 w-12 rounded-sm overflow-hidden border border-zinc-200 bg-zinc-100 shrink-0 flex-shrink-0">
                    <video src={post.content.output_video_url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-sm border border-zinc-200 bg-zinc-100 flex items-center justify-center shrink-0">
                    {post.platform === 'instagram' ? (
                      <Instagram className="h-5 w-5 text-pink-400" />
                    ) : (
                      <span className="text-sm font-bold text-zinc-500">TT</span>
                    )}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {post.content_id ? (
                    <Link
                      href={`/dashboard/content/${post.content_id}`}
                      className="text-sm font-medium text-zinc-800 truncate block hover:text-orange-600 hover:underline"
                    >
                      {post.content?.name || post.project?.name || post.project?.template?.name || 'Untitled'}
                    </Link>
                  ) : post.project_id ? (
                    <Link
                      href={`/dashboard/projects/${post.project_id}`}
                      className="text-sm font-medium text-zinc-800 truncate block hover:text-orange-600 hover:underline"
                    >
                      {post.project?.name || post.project?.template?.name || 'Untitled'}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-zinc-800 truncate">
                      {post.project?.name || post.project?.template?.name || 'Untitled'}
                    </p>
                  )}
                  <p className="text-xs text-zinc-500">
                    <ScheduleTime isoString={post.scheduled_time} /> · {post.platform}
                    {post.content && ` · ${post.content.status}`}
                  </p>
                </div>

                <Badge className={getStatusColor(post.status)}>{post.status}</Badge>

                <ScheduleActions postId={post.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
