'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export function ScheduleActions({ postId }: { postId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm('Delete this scheduled post?')) return;
    setLoading(true);
    try {
      await fetch(`/api/schedule/${postId}`, { method: 'DELETE' });
      router.refresh();
    } catch {
      alert('Failed to delete');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} loading={loading}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
