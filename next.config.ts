import type { NextConfig } from "next";

const securityHeaders = [
  // Clickjacking protection — nothing in the app is meant to be framed.
  { key: "X-Frame-Options", value: "DENY" },
  // Stops browsers from MIME-sniffing a response away from its declared type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak the full referring URL (which can contain project/document
  // ids) to third-party origins when a link is clicked.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Opt out of browser features the app never uses.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
