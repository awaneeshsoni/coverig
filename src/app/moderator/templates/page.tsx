import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth/roles';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/utils';
import { Film, Plus } from 'lucide-react';
import Link from 'next/link';
import type { Template, TemplateStatus } from '@/types';

function statusBadge(status: TemplateStatus) {
  const map: Record<TemplateStatus, string> = {
    draft: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
    processing: 'bg-orange-50 text-orange-700 border border-orange-200',
    published: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    rejected: 'bg-red-50 text-red-700 border border-red-200',
  };
  return map[status] || map.draft;
}

export default async function ModTemplatesPage() {
  const userInfo = await getUserRole();
  if (!userInfo) return null;

  const supabase = createServerSupabaseClient();
  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .eq('creator_id', userInfo.userId)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">My Templates</h1>
          <p className="text-sm text-zinc-500 mt-1">Create and manage video templates</p>
        </div>
        <Link href="/moderator/templates/new">
          <Button><Plus className="h-4 w-4 mr-2" />Create Template</Button>
        </Link>
      </div>

      {(!templates || templates.length === 0) ? (
        <EmptyState
          icon={Film}
          title="No templates yet"
          description="Create your first template to get started."
          action={<Link href="/moderator/templates/new"><Button>Create Template</Button></Link>}
        />
      ) : (
        <div className="grid gap-4">
          {(templates as Template[]).map((t) => (
            <Card key={t.id} className="hover:border-orange-500/50 transition-colors">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-12 w-12 rounded-sm border border-zinc-200 bg-zinc-100 flex items-center justify-center shrink-0">
                  <Film className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/moderator/templates/${t.id}`}
                    className="text-sm font-medium text-zinc-800 truncate block hover:text-orange-600 hover:underline"
                  >
                    {t.name}
                  </Link>
                  <p className="text-xs text-zinc-500">{formatDate(t.created_at)} · {t.config_json.scenes?.length || 0} scenes</p>
                </div>
                <Badge className={statusBadge(t.status)}>{t.status}</Badge>
                <Link href={`/moderator/templates/${t.id}`}>
                  <Button variant="ghost" size="sm">Edit</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
