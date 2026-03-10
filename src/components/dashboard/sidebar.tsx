'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Film,
  FolderOpen,
  Calendar,
  LogOut,
  Sparkles,
  Instagram,
  CreditCard,
  Shield,
  BarChart3,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '@/types';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/templates', label: 'Templates', icon: Film },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderOpen },
  { href: '/dashboard/content', label: 'Content', icon: Film },
  { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Settings', icon: Instagram },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
];

export function Sidebar({ user, role = 'user' }: { user: User; role?: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex w-64 flex-col border-r border-zinc-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-200">
        <div className="h-8 w-8 flex items-center justify-center border border-orange-500 bg-orange-50">
          <Sparkles className="h-4 w-4 text-orange-500" />
        </div>
        <span className="text-lg font-bold text-orange-500">
          Coverig
        </span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors border-l-2 -ml-px',
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

        {(role === 'moderator' || role === 'admin') && (
          <div className="pt-4 mt-4 border-t border-zinc-200">
            <Link
              href="/moderator/templates"
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors border-l-2 border-l-transparent hover:border-l-orange-500/50 -ml-px"
            >
              <Shield className="h-3.5 w-3.5 shrink-0" />
              Moderator
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t border-zinc-200 px-3 py-4">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="h-8 w-8 flex items-center justify-center border border-orange-500/40 bg-orange-50 text-xs font-bold text-orange-600">
            {user.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-zinc-600 truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
