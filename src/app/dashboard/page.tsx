import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';
import { Film, FolderOpen, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import type { Project } from '@/types';

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: projects } = await supabase
    .from('projects')
    .select('*, template:templates(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const { count: totalProjects } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: totalContent } = await supabase
    .from('content')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: completedContent } = await supabase
    .from('content')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed');

  const { count: totalTemplates } = await supabase
    .from('templates')
    .select('*', { count: 'exact', head: true });

  const stats = [
    { label: 'Projects', value: totalProjects || 0, icon: FolderOpen, color: 'text-orange-500' },
    { label: 'Content', value: totalContent || 0, icon: Film, color: 'text-blue-400' },
    { label: 'Renders', value: completedContent || 0, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Templates', value: totalTemplates || 0, icon: Film, color: 'text-zinc-500' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Overview of your video projects</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 py-5">
              <div className={`rounded-sm border border-zinc-200 p-2.5 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-zinc-900">{stat.value}</p>
                <p className="text-xs text-zinc-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">Recent Projects</h2>
          <Link href="/dashboard/projects">
            <Button variant="ghost" size="sm">View all</Button>
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
          <div className="grid gap-3">
            {(projects as Project[]).map((project) => (
              <Card key={project.id} className="hover:border-orange-500/50 transition-colors">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-sm border border-zinc-200 bg-zinc-50 flex items-center justify-center">
                      <Film className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <Link
                        href={`/dashboard/projects/${project.id}`}
                        className="text-sm font-medium text-zinc-800 hover:text-orange-600 hover:underline"
                      >
                        {project.template?.name || 'Untitled'}
                      </Link>
                      <p className="text-xs text-zinc-600">{formatDate(project.created_at)}</p>
                    </div>
                  </div>
                  <Link href={`/dashboard/projects/${project.id}`}>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
