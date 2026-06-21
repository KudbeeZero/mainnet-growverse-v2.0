import Link from "next/link";

/** A compact breadcrumb trail (Pods › Pod name › Plant). The last item is the
 * current page (no link); earlier items link to their level so the drill-down
 * Pods → Pod → Plant always has a clear way back up. */
export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-gray-400"
    >
      {items.map((it, i) => (
        <span key={`${it.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-gray-600">›</span>}
          {it.href ? (
            <Link href={it.href} className="text-grow-300 hover:underline">
              {it.label}
            </Link>
          ) : (
            <span className="text-gray-200">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
