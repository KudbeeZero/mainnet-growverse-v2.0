import type { ReactNode } from "react";

export function EmptyState({
  icon = "✺",
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="text-3xl opacity-70">{icon}</div>
      <div className="font-medium text-gray-200">{title}</div>
      {hint && <div className="max-w-md text-sm text-gray-500">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const message =
    error instanceof Error ? error.message : "Something went wrong loading this.";
  return (
    <div className="rounded-xl border border-red-800 bg-red-950/40 px-5 py-4 text-sm text-red-200">
      <div className="font-medium">Couldn&apos;t load</div>
      <div className="mt-0.5 text-red-300/80">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-md border border-red-700 px-2.5 py-1 text-xs text-red-100 hover:bg-red-900/40"
        >
          Retry
        </button>
      )}
    </div>
  );
}
