import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { TemplateEditor } from '@/components/template-editor/editor';
import type { Project, Template } from '@/types';

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

  if (!project?.template) notFound();

  return <TemplateEditor template={project.template as Template} project={project as Project} />;
}
