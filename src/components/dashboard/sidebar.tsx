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
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';
import type { UserRole } from '@/types';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/templates', label: 'Templates', icon: Film },
  { href: '/dashboard/projects', label: 'Projects', icon: FolderOpen },
  { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar },
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
    <aside className="flex w-64 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-zinc-800">
        <Sparkles className="h-6 w-6 text-orange-500" />
        <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
          Coverig
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
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

        {(role === 'moderator' || role === 'admin') && (
          <div className="pt-3 mt-3 border-t border-zinc-800">
            <Link
              href="/moderator/templates"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-orange-400/70 hover:bg-orange-500/10 hover:text-orange-400 transition-colors"
            >
              <Shield className="h-4 w-4" />
              Moderator Panel
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t border-zinc-800 px-3 py-4">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center text-xs font-medium text-orange-400">
            {user.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
