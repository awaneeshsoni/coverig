import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function truncate(str: string, length: number) {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
    queued: 'bg-amber-50 text-amber-700 border border-amber-200',
    rendering: 'bg-orange-50 text-orange-700 border border-orange-200',
    completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    failed: 'bg-red-50 text-red-700 border border-red-200',
    pending: 'bg-amber-50 text-amber-700 border border-amber-200',
    posted: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  };
  return colors[status] || 'bg-zinc-100 text-zinc-600 border border-zinc-200';
}
