'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, Plus, ArrowLeft, Sparkles, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

const navItems = [
  { href: '/moderator/templates', label: 'My Templates', icon: Film },
  { href: '/moderator/templates/new', label: 'Create Template', icon: Plus },
];

export function ModeratorSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-zinc-800">
        <Sparkles className="h-6 w-6 text-orange-500" />
        <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
          Coverig
        </span>
      </div>

      <div className="px-3 pt-4 pb-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10">
          <Shield className="h-4 w-4 text-orange-400" />
          <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
            {role === 'admin' ? 'Admin' : 'Moderator'}
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === '/moderator/templates'
            ? pathname === '/moderator/templates' || pathname === '/moderator'
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-orange-500/10 text-orange-400'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </nav>
    </aside>
  );
}
