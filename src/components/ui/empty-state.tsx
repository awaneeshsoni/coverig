import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-sm p-4 mb-4 border border-orange-500/40 bg-orange-50">
        <Icon className="h-8 w-8 text-orange-500" />
      </div>
      <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900 mb-1">{title}</h3>
      <p className="text-sm text-zinc-600 max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}
