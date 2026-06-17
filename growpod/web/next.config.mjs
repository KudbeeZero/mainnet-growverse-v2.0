/** @type {import('next').NextConfig} */

// When NEXT_PUBLIC_API_BASE is empty, the client uses relative URLs and
// Next.js rewrites proxy them to the local gunicorn backend.
// Set NEXT_PUBLIC_API_BASE to a full URL (e.g. https://api.example.com) in
// production when the API and frontend are on separate domains.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

// Defence-in-depth HTTP security headers.
//
// CSP note: the App Router emits inline bootstrap/hydration scripts. The only
// ways to allow them are a per-request nonce (which can't be baked into the
// statically-prerendered pages this app ships) or 'unsafe-inline'. We take
// 'unsafe-inline' — the same posture already used for styles. Script *sources*
// are still locked to same-origin (no attacker-controlled scripts) and eval is
// disallowed, so this keeps meaningful XSS mitigation while letting the app
// actually hydrate. connect-src is limited to self + any configured API origin.
const connectSrc = API_BASE ? `'self' ${API_BASE}` : "'self'";

// Next.js dev mode evaluates modules and runs HMR via eval(), which requires
// 'unsafe-eval'. Production builds never use eval, so we only relax script-src
// in development — the deployed CSP stays strict (no 'unsafe-eval').
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  scriptSrc,
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: "/home/runner/workspace/web",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${BACKEND_URL}/health`,
      },
      {
        source: "/openapi.json",
        destination: `${BACKEND_URL}/openapi.json`,
      },
    ];
  },
};

export default nextConfig;
