/**
 * The product's name and positioning, in one place. Everything user-facing
 * reads from here.
 */
export const APP_NAME = "Novela"

/** The name before the rename (KoraKagaj). Files made under it must keep opening. */
export const LEGACY_SLUG = "korakagaj"

/** One-line promise shown in page titles and metadata. */
export const TAGLINE = "free, private novel writing software that catches your plot holes"

/** The landing page headline. */
export const HEADLINE = "Free. Private. No AI. Catches your plot holes."

/** Production domain, without protocol. */
export const DOMAIN = "novela.akadeepesh.com"

/**
 * The public origin for canonical links, the sitemap and robots.txt.
 * `NEXT_PUBLIC_APP_URL` overrides it (for a preview deployment); production
 * builds otherwise use the real domain.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? (process.env.NODE_ENV === "production" ? `https://${DOMAIN}` : "http://localhost:3000")

/** Longer description for metadata, the manifest and link previews. */
export const DESCRIPTION =
  "Free novel writing software that keeps your book on your device. A story bible, continuity checks that catch plot holes, style checks, and print-ready PDFs for Amazon KDP. No account, no AI."

/**
 * File extension for project files and backups (a zip inside). Importing
 * also accepts `.zip` and the old `.korakagaj`.
 */
export const BACKUP_FILE_EXTENSION = "novela"

/**
 * Where paid template packs are sold (for example a Lemon Squeezy or Gumroad
 * store). Empty until the store exists; the More templates page then says
 * the store is coming instead of linking anywhere.
 */
export const TEMPLATE_STORE_URL = ""

/**
 * Donation page (Ko-fi). Not set up yet; the donate links stay hidden
 * while this is empty.
 */
export const DONATE_URL = ""

/** The public source repository, linked as "Source code". */
export const REPO_URL = "https://github.com/akadeepesh/Novela"

/** Contact address for privacy questions, shown on the privacy page. Empty hides it. */
export const CONTACT_EMAIL = "akadeepesh1710@gmail.com"
