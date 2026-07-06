"use client";

// global-error replaces the ENTIRE root layout (Providers/AppShell included) when
// the root layout itself throws, so it must render its own <html>/<body> and can't
// depend on anything the layout provides.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#070a0e", color: "#e5e7eb" }}>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.875rem" }}>🥀</div>
          <div style={{ fontWeight: 500 }}>Something went wrong</div>
          <div style={{ maxWidth: "28rem", fontSize: "0.875rem", color: "#9ca3af" }}>
            {error instanceof Error ? error.message : "The app hit an unexpected error."}
          </div>
          <button
            onClick={reset}
            style={{
              borderRadius: "0.375rem",
              border: "1px solid #16a34a",
              background: "#15803d",
              color: "#fff",
              padding: "0.625rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
