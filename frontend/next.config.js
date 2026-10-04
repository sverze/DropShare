/** @type {import('next').NextConfig} */
const { version } = require('./package.json');

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' blob: data:",
      "worker-src 'self' blob:",
    ].join("; "),
  },
];

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false,
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkOnly',
    },
  ],
});

module.exports = withPWA({
  output: "standalone",
  env: {
    VERSION: version,
  },
  async headers() {
    // The embed routes used to get a relaxed policy - `frame-ancestors *` and
    // no X-Frame-Options - so a share could be iframed on any third-party site.
    // That only works while shares are publicly readable, and they no longer
    // are: ShareSecurityGuard requires an authenticated viewer who is the
    // creator, a group member or an admin. A cross-origin iframe carries no
    // session, so the relaxed policy bought nothing and cost the embed routes
    // their clickjacking protection. They now get the same headers as
    // everything else: X-Frame-Options DENY and frame-ancestors 'none'.
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
});
