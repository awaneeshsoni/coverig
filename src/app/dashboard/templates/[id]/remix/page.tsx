import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { TemplateEditor } from '@/components/template-editor/editor';
import type { Template } from '@/types';

interface Props {
  params: { id: string };
}

export default async function RemixPage({ params }: Props) {
  const supabase = createServerSupabaseClient();
  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!template) notFound();

  return <TemplateEditor template={template as Template} />;
}
