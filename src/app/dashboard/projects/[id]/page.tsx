import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ProjectDetail } from '@/components/project-detail';
import type { Project } from '@/types';

interface Props {
  params: { id: string };
}

export default async function ProjectPage({ params }: Props) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: project } = await supabase
    .from('projects')
    .select('*, template:templates(*)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!project) notFound();

  return <ProjectDetail project={project as Project} />;
}
