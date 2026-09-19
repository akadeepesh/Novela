import type { Metadata } from "next";
import { Public_Sans, Manrope, Literata } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

// Headings — used in app chrome (sidebar, dashboard, dialogs), not in manuscripts
const manropeHeading = Manrope({ subsets: ["latin"], variable: "--font-heading" });

// UI body copy — buttons, labels, nav, metadata
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-sans" });

// Manuscript reading/writing face — the actual page content lives in this font.
// Literata is built for long-form reading comfort; this is the one typographic
// choice writers will notice first, so it stays separate from UI chrome fonts.
const literataSerif = Literata({
  subsets: ["latin"],
  variable: "--font-serif",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "KoraKagaj — a calmer place to write your book",
  description:
    "A focused writing workspace for novelists, poets, and storytellers — manuscript, characters, world, and plot, all in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        "font-sans",
        publicSans.variable,
        manropeHeading.variable,
        literataSerif.variable
      )}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
