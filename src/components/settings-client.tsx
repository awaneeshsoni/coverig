'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Instagram, Unlink, CheckCircle, AlertCircle } from 'lucide-react';
import type { InstagramAccount } from '@/types';

export function SettingsClient({ igAccount }: { igAccount: InstagramAccount | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);

  const success = searchParams.get('success');
  const error = searchParams.get('error');

  async function handleDisconnect() {
    if (!confirm('Disconnect your Instagram account?')) return;
    setDisconnecting(true);
    try {
      await fetch('/api/instagram/account', { method: 'DELETE' });
      router.refresh();
    } catch {
      alert('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your account and integrations</p>
      </div>

      {success === 'instagram_connected' && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
          <p className="text-sm text-emerald-700">Instagram connected successfully!</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <p className="text-sm text-red-700">{decodeURIComponent(error)}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-orange-500" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-600">Instagram Account</h2>
          </div>
        </CardHeader>
        <CardContent>
          {igAccount ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 font-bold text-sm">
                  {igAccount.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900">@{igAccount.username}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">Connected</Badge>
                    {igAccount.token_expiry && (
                      <span className="text-xs text-zinc-500">
                        Expires: {new Date(igAccount.token_expiry).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={handleDisconnect} loading={disconnecting}>
                <Unlink className="h-4 w-4 mr-1" />
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-600">Connect your Instagram Professional account to publish Reels</p>
              <a href="/api/auth/instagram">
                <Button>
                  <Instagram className="h-4 w-4 mr-2" />
                  Connect Instagram
                </Button>
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
