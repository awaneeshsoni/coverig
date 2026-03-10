import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getStatusColor, formatDate } from '@/lib/utils';
import { Film, Download, ExternalLink, Play } from 'lucide-react';
import Link from 'next/link';
import type { Content } from '@/types';

export default async function ContentPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: content } = await supabase
    .from('content')
    .select('*, project:projects(*, template:templates(*))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Content</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Your final renders. Publish from projects to add here. Schedule, download, or edit the source project.
        </p>
      </div>

      {(!content || content.length === 0) ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-12 text-center">
          <Film className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-zinc-700">No content yet</h2>
          <p className="text-sm text-zinc-500 mt-2 max-w-sm mx-auto">
            Click &quot;Save and Publish&quot; when editing a project to add your final render here.
          </p>
          <Link
            href="/dashboard/projects"
            className="inline-block mt-4 text-sm font-medium text-orange-500 hover:text-orange-600"
          >
            Go to Projects →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {(content as Content[]).map((item) => (
            <Card key={item.id} className="hover:border-orange-500/50 transition-colors">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-12 w-12 rounded-sm border border-zinc-200 bg-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {item.output_video_url ? (
                    <video
                      src={item.output_video_url}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <Play className="h-5 w-5 text-orange-500 animate-pulse" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/dashboard/content/${item.id}`}
                    className="text-sm font-medium text-zinc-800 truncate block hover:text-orange-600 hover:underline"
                  >
                    {item.name || item.project?.name || item.project?.template?.name || 'Untitled'}
                  </Link>
                  <p className="text-xs text-zinc-500">{formatDate(item.created_at)}</p>
                </div>

                <Badge className={getStatusColor(item.status)}>{item.status}</Badge>

                <div className="flex items-center gap-2">
                  {item.output_video_url && (
                    <a
                      href={item.output_video_url}
                      download
                      className="p-2 text-zinc-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                  <Link
                    href={`/dashboard/content/${item.id}`}
                    className="p-2 text-zinc-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                    title="View"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
