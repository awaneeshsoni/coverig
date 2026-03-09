import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { getStatusColor, formatDate } from '@/lib/utils';
import { Calendar, Instagram } from 'lucide-react';
import type { ScheduledPost } from '@/types';
import { ScheduleActions } from '@/components/schedule-actions';

export default async function SchedulePage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: posts } = await supabase
    .from('scheduled_posts')
    .select('*, project:projects(*, template:templates(*))')
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
            <Card key={post.id} className="hover:border-orange-300 transition-colors">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                  {post.platform === 'instagram' ? (
                    <Instagram className="h-5 w-5 text-pink-400" />
                  ) : (
                    <span className="text-sm font-bold text-zinc-500">TT</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 truncate">
                    {post.project?.template?.name || 'Untitled'}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatDate(post.scheduled_time)} · {post.platform}
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
