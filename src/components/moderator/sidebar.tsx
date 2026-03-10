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
    <aside className="flex w-64 flex-col border-r border-zinc-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-200">
        <div className="h-8 w-8 flex items-center justify-center border border-orange-500 bg-orange-50">
          <Sparkles className="h-4 w-4 text-orange-500" />
        </div>
        <span className="text-sm font-bold tracking-widest uppercase text-orange-500">
          Coverig
        </span>
      </div>

      <div className="px-2 pt-4 pb-2">
        <div className="flex items-center gap-2 px-3 py-2 border border-orange-500/40 bg-orange-50">
          <Shield className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">
            {role === 'admin' ? 'Admin' : 'Moderator'}
          </span>
        </div>
      </div>

      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.href === '/moderator/templates'
            ? pathname === '/moderator/templates' || pathname === '/moderator'
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors border-l-2 -ml-px',
                isActive
                  ? 'border-l-orange-500 bg-orange-50 text-orange-600'
                  : 'border-l-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 hover:border-l-zinc-300'
              )}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 text-xs font-semibold uppercase tracking-widest text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors border-l-2 border-l-transparent -ml-px"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
        </div>
      </nav>
    </aside>
  );
}
