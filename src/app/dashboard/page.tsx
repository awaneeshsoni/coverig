import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { getStatusColor, formatDate } from '@/lib/utils';
import { Film, FolderOpen, Clock, CheckCircle } from 'lucide-react';
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

  const { count: completedProjects } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed');

  const { count: renderingProjects } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['queued', 'rendering']);

  const { count: totalTemplates } = await supabase
    .from('templates')
    .select('*', { count: 'exact', head: true });

  const stats = [
    { label: 'Total Projects', value: totalProjects || 0, icon: FolderOpen, color: 'text-orange-500' },
    { label: 'Completed', value: completedProjects || 0, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Rendering', value: renderingProjects || 0, icon: Clock, color: 'text-yellow-400' },
    { label: 'Templates', value: totalTemplates || 0, icon: Film, color: 'text-blue-400' },
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
              <div className={`rounded-lg bg-zinc-100 p-2.5 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-900">{stat.value}</p>
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
              <Card key={project.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                      <Film className="h-5 w-5 text-zinc-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-800">
                        {project.template?.name || 'Untitled'}
                      </p>
                      <p className="text-xs text-zinc-500">{formatDate(project.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                    <Link href={`/dashboard/projects/${project.id}`}>
                      <Button variant="ghost" size="sm">View</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
