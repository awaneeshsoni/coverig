import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth/roles';
import { notFound } from 'next/navigation';
import { TemplateForm } from '@/components/moderator/template-form';
import type { Template } from '@/types';

interface Props { params: { id: string } }

export default async function EditTemplatePage({ params }: Props) {
  const userInfo = await getUserRole();
  if (!userInfo) return null;

  const supabase = createServerSupabaseClient();
  const { data: template } = await supabase
    .from('templates')
    .select('*')
    .eq('id', params.id)
    .eq('creator_id', userInfo.userId)
    .single();

  if (!template) notFound();

  return <TemplateForm template={template as Template} />;
}
