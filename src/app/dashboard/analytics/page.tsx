import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';
import { BarChart3, Heart, MessageCircle, Eye, Share2 } from 'lucide-react';
import Link from 'next/link';
import { AnalyticsClient } from '@/components/analytics-client';
import type { InstagramPost } from '@/types';

export default async function AnalyticsPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: posts } = await supabase
    .from('instagram_posts')
    .select('*, analytics:instagram_analytics(*), project:projects(template:templates(name))')
    .eq('user_id', user.id)
    .eq('status', 'published')
    .order('posted_at', { ascending: false });

  const postsList = (posts || []) as (InstagramPost & { analytics?: { views: number; likes: number; comments: number; reach: number; impressions: number; saves: number }[] })[];

  const totals = postsList.reduce(
    (acc, p) => {
      const a = Array.isArray(p.analytics) ? p.analytics[0] : p.analytics;
      if (a) {
        acc.views += a.views || 0;
        acc.likes += a.likes || 0;
        acc.comments += a.comments || 0;
        acc.reach += a.reach || 0;
        acc.saves += a.saves || 0;
      }
      return acc;
    },
    { views: 0, likes: 0, comments: 0, reach: 0, saves: 0 }
  );

  const stats = [
    { label: 'Total posts', value: postsList.length, icon: BarChart3 },
    { label: 'Views / engagement', value: totals.views || totals.reach, icon: Eye },
    { label: 'Likes', value: totals.likes, icon: Heart },
    { label: 'Comments', value: totals.comments, icon: MessageCircle },
    { label: 'Saves', value: totals.saves, icon: Share2 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Instagram Analytics</h1>
          <p className="text-sm text-zinc-500 mt-1">See what Coverig has done for your account</p>
        </div>
        <AnalyticsClient />
      </div>

      {postsList.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No Instagram posts yet"
          description="Post content to Instagram from the Content page to see analytics here. Connect your Instagram account in Settings first."
          action={
            <div className="flex gap-3">
              <Link href="/dashboard/settings">
                <Button variant="secondary">Connect Instagram</Button>
              </Link>
              <Link href="/dashboard/content">
                <Button>View Content</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="flex items-center gap-4 py-5">
                  <div className="rounded-sm border border-zinc-200 p-2.5 text-orange-500">
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-mono text-zinc-900">{stat.value.toLocaleString()}</p>
                    <p className="text-xs text-zinc-500">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">Recent posts</h2>
            <div className="grid gap-4">
              {postsList.map((post) => {
                const a = Array.isArray(post.analytics) ? post.analytics[0] : post.analytics;
                return (
                  <Card key={post.id}>
                    <CardContent className="flex items-center gap-4 py-4">
                      <div className="h-10 w-10 rounded-sm border border-pink-200 bg-pink-50 flex items-center justify-center shrink-0">
                        <BarChart3 className="h-5 w-5 text-pink-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800">
                          {post.project?.template?.name || 'Untitled'}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {post.posted_at ? formatDate(post.posted_at) : '—'}
                        </p>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <span className="flex items-center gap-1.5 text-zinc-600">
                          <Eye className="h-4 w-4" />
                          {(a?.views ?? a?.reach ?? 0).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1.5 text-zinc-600">
                          <Heart className="h-4 w-4" />
                          {(a?.likes ?? 0).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1.5 text-zinc-600">
                          <MessageCircle className="h-4 w-4" />
                          {(a?.comments ?? 0).toLocaleString()}
                        </span>
                        {a?.saves ? (
                          <span className="flex items-center gap-1.5 text-zinc-600">
                            <Share2 className="h-4 w-4" />
                            {a.saves.toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
