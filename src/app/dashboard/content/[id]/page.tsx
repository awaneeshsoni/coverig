import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ContentDetail } from '@/components/content-detail';
import type { Content } from '@/types';

interface Props {
  params: { id: string };
}

export default async function ContentPage({ params }: Props) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: content } = await supabase
    .from('content')
    .select('*, project:projects(*, template:templates(*))')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!content) notFound();

  return <ContentDetail content={content as Content} />;
}
