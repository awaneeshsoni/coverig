import { getUserRole, canManageTemplates } from '@/lib/auth/roles';
import { redirect } from 'next/navigation';
import { ModeratorSidebar } from '@/components/moderator/sidebar';

export default async function ModeratorLayout({ children }: { children: React.ReactNode }) {
  const userInfo = await getUserRole();

  if (!userInfo) redirect('/login');
  if (!canManageTemplates(userInfo.role)) redirect('/dashboard');

  return (
    <div className="flex h-screen overflow-hidden">
      <ModeratorSidebar role={userInfo.role} />
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
