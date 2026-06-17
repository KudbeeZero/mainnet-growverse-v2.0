export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-grow-400 border-t-transparent ${className}`}
      role="status"
      aria-label="loading"
    />
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-gray-400">
      <Spinner /> {label}
    </div>
  );
}
