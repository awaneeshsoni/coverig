'use client';

export function ScheduleTime({ isoString }: { isoString: string }) {
  const date = new Date(isoString);
  const formatted = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
  return <>{formatted}</>;
}
