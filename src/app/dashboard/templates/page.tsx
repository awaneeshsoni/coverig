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
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {(templates as Template[]).map((template) => (
            <Card key={template.id} className="group overflow-hidden hover:border-orange-300 transition-colors">
              <TemplateCardPreview previewVideoUrl={template.preview_video_url} />
              <CardContent className="py-4">
                <h3 className="text-sm font-semibold text-zinc-900 mb-1">{template.name}</h3>
                <p className="text-xs text-zinc-500 mb-4 line-clamp-2">{template.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    {template.config_json.scenes?.length || 0} scenes
                  </span>
                  <Link href={`/dashboard/templates/${template.id}/remix`}>
                    <Button size="sm">Remix</Button>
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
