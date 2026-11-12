"use client"

// This only fires if the root layout itself throws — rare, but when it
// does, Next.js discards the normal layout entirely, so this has to bring
// its own <html>/<body> and can't lean on globals.css, fonts, or any app
// component that might itself be implicated in the crash.

import { APP_NAME } from "@/lib/brand"

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fcfaf7",
          color: "#251e19",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>
            {APP_NAME} hit a snag.
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "#7d6a58", marginBottom: 20 }}>
            Something went wrong loading the app. Reloading usually fixes it.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#8e5138",
              color: "#fcfaf7",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
