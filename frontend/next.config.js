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

const embedSecurityHeaders = securityHeaders
  .filter((header) => header.key !== "X-Frame-Options")
  .map((header) => {
    if (header.key !== "Content-Security-Policy") return header;

    return {
      ...header,
      value: [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors *",
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
    };
  });

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
    return [
      {
        source: "/embed/:path*",
        headers: embedSecurityHeaders,
      },
      {
        source: "/((?!embed(?:/|$)).*)",
        headers: securityHeaders,
      },
    ];
  },
});
