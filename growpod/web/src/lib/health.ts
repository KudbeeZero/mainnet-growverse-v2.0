// Pure presentation mappers for the dev/tester connectivity badge.
//
// The badge tells a tester at a glance whether the backend the time controls
// talk to is reachable. Keeping the label/colour mapping pure makes it
// unit-testable and keeps the component dumb.

export type HealthStatus = "checking" | "online" | "offline";

/** Short label for the connectivity badge. */
export function healthLabel(status: HealthStatus): string {
  switch (status) {
    case "online":
      return "Server online";
    case "offline":
      return "Server unreachable";
    default:
      return "Checking…";
  }
}

/** Tailwind classes for the status dot. */
export function healthDotClass(status: HealthStatus): string {
  switch (status) {
    case "online":
      return "bg-grow-500";
    case "offline":
      return "bg-red-500";
    default:
      return "bg-amber-400 animate-pulse";
  }
}

/** Resolve the status from a react-query result's flags. */
export function healthStatus(flags: {
  isLoading: boolean;
  isError: boolean;
}): HealthStatus {
  if (flags.isError) return "offline";
  if (flags.isLoading) return "checking";
  return "online";
}
