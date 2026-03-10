'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function AnalyticsClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRefresh() {
    setLoading(true);
    try {
      await fetch('/api/instagram/analytics?sync=true');
      router.refresh();
    } catch {
      alert('Failed to refresh analytics');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleRefresh} loading={loading}>
      <RefreshCw className="h-4 w-4 mr-2" />
      Refresh analytics
    </Button>
  );
}
