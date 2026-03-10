import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { TemplateCardPreview } from '@/components/template-card-preview';
import { Film } from 'lucide-react';
import Link from 'next/link';
import type { Template } from '@/types';

export default async function TemplatesPage() {
  const supabase = createServerSupabaseClient();
  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Templates</h1>
        <p className="text-sm text-zinc-500 mt-1">Browse and remix video templates</p>
      </div>

      {(!templates || templates.length === 0) ? (
        <EmptyState
          icon={Film}
          title="No templates available"
          description="Templates will appear here once they've been added to the platform."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(templates as Template[]).map((template) => (
            <Card key={template.id} className="overflow-hidden border-zinc-200 hover:border-orange-500/70 hover:shadow-md transition-all duration-200 h-full flex flex-col group">
              <Link href={`/dashboard/templates/${template.id}/remix`} className="block flex-shrink-0">
                <div className="relative">
                  <TemplateCardPreview previewVideoUrl={template.preview_video_url} />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-orange-500/90 text-white text-xs font-medium">
                    {template.config_json.scenes?.length || 0} scenes
                  </div>
                </div>
              </Link>
              <CardContent className="flex flex-col flex-1 py-4 px-4">
                <Link
                  href={`/dashboard/templates/${template.id}/remix`}
                  className="text-base font-semibold text-zinc-900 mb-1.5 line-clamp-1 hover:text-orange-600 hover:underline"
                >
                  {template.name}
                </Link>
                <p className="text-sm text-zinc-500 line-clamp-2 flex-1 mb-4">{template.description || 'No description'}</p>
                <Link href={`/dashboard/templates/${template.id}/remix`}>
                  <Button size="sm" className="w-full mt-auto">Remix</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
