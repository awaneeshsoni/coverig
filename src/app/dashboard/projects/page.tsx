import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';
import { FolderOpen, Film, Pencil } from 'lucide-react';
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
            <Card key={project.id} className="hover:border-orange-500/50 transition-colors">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-12 w-12 rounded-sm border border-zinc-200 bg-zinc-100 flex items-center justify-center shrink-0">
                  <Film className="h-5 w-5 text-orange-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/dashboard/projects/${project.id}`}
                    className="text-sm font-medium text-zinc-800 truncate block hover:text-orange-600 hover:underline"
                  >
                    {project.name || project.template?.name || 'Untitled Project'}
                  </Link>
                  <p className="text-xs text-zinc-500">{formatDate(project.created_at)}</p>
                </div>

                <Link
                  href={`/dashboard/projects/${project.id}`}
                  className="p-2 text-zinc-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
