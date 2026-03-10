'use client';

import { useEffect, useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  /** Scroll into view when error appears */
  scrollIntoView?: boolean;
}

export function ErrorBanner({ message, onDismiss, scrollIntoView = true }: ErrorBannerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message && scrollIntoView && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [message, scrollIntoView]);

  return (
    <div
      ref={ref}
      role="alert"
      className="flex items-center gap-3 rounded-lg border-2 border-red-500 bg-red-50 px-4 py-3 text-red-800 shadow-sm"
    >
      <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
      <p className="flex-1 text-sm font-medium leading-snug min-w-0">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-1 hover:bg-red-100 text-red-600 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
