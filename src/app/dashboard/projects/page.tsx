import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getStatusColor, formatDate } from '@/lib/utils';
import { FolderOpen, Film, Download, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { Project } from '@/types';

export default async function ProjectsPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: projects } = await supabase
    .from('projects')
    .select('*, template:templates(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Projects</h1>
          <p className="text-sm text-zinc-500 mt-1">All your video projects</p>
        </div>
        <Link href="/dashboard/templates">
          <Button>New Project</Button>
        </Link>
      </div>

      {(!projects || projects.length === 0) ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Start by browsing templates and creating your first video project."
          action={
            <Link href="/dashboard/templates">
              <Button>Browse Templates</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {(projects as Project[]).map((project) => (
            <Card key={project.id} className="hover:border-orange-300 transition-colors">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-12 w-12 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
                  {project.output_video_url ? (
                    <video
                      src={project.output_video_url}
                      className="h-full w-full rounded-lg object-cover"
                      muted={false}
                      playsInline
                    />
                  ) : (
                    <Film className="h-5 w-5 text-zinc-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 truncate">
                    {project.template?.name || 'Untitled Project'}
                  </p>
                  <p className="text-xs text-zinc-500">{formatDate(project.created_at)}</p>
                </div>

                <Badge className={getStatusColor(project.status)}>{project.status}</Badge>

                <div className="flex items-center gap-2">
                  {project.output_video_url && (
                    <a
                      href={project.output_video_url}
                      download
                      className="text-zinc-500 hover:text-zinc-800 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                  <Link href={`/dashboard/projects/${project.id}`}>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
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
