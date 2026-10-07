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
  experimental: {
    // Autosave sends the whole chapter through a Server Action. The default
    // body limit is 1 MB, which a long chapter exceeds. Must stay above
    // MAX_CHAPTER_BYTES in app/projects/[id]/chapters/[chapterId]/actions.ts,
    // and below Vercel's 4.5 MB request limit.
    serverActions: { bodySizeLimit: "4mb" },
  },
  // pdf.js loads its worker and font/cmap data relative to its own files, so
  // it has to run from node_modules as-is rather than being bundled (PDF
  // import — lib/import/inspect-pdf.ts).
  serverExternalPackages: ["pdfjs-dist"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
