/**
 * Shared (client + server) constants and copy for PDF book import.
 * Deliberately free of server-only imports so the intake screen can
 * pre-check a file in the browser with exactly the same limits the
 * server enforces afterwards.
 */

/** v1 page cap — enforced at intake with a clear message, never by truncating. */
export const IMPORT_MAX_PAGES = 110;

/**
 * Sanity ceiling on the file itself. The plan sets no byte cap; this only
 * exists so an accidental 400MB upload fails fast instead of timing out
 * somewhere less friendly. A 102-page vector-decorated interior is a few MB.
 */
export const IMPORT_MAX_BYTES = 50 * 1024 * 1024;

/** Above this the browser uploads in parallel parts (Vercel Blob multipart). */
export const IMPORT_MULTIPART_THRESHOLD_BYTES = 15 * 1024 * 1024;

/** Non-whitespace characters a page needs before it counts as "has text". A lone "— 12 —" page marker doesn't. */
export const IMPORT_MIN_CHARS_FOR_TEXT_PAGE = 20;

/** How long an untouched import survives before its scratch record expires. Each step the person completes resets it. */
export const IMPORT_JOB_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Plain-language promise of how each book type gets split into
 * chapters/poems, shown on the type question. Kept to what the plan
 * actually commits to (separator glyphs for poetry, headings for prose,
 * and an honest "you tell me" fallback) — Step 4 has to live up to these.
 */
export const IMPORT_SPLIT_HINT: Record<"novel" | "poetry" | "script-writing" | "custom", string> = {
  novel: "We look for chapter headings — “Chapter One”, “1.”, or a line set larger than the text around it.",
  poetry: "We look for a mark that repeats between poems, like a “— 12 —” or a row of asterisks.",
  "script-writing": "We look for episode titles and scene headings, like “INT. KITCHEN — DAY”.",
  custom: "We look for repeating separators and headings both, and you check the split before anything is saved.",
};

/**
 * Access mode for scratch PDFs in Vercel Blob. "private" means there is no
 * public URL at all — the file can only be read back server-side, with the
 * store token — which is what you want for someone's unpublished manuscript.
 * It must match how the Blob store was created (Vercel → Storage → the
 * store's settings); a mismatch is refused by Blob's API with a 400.
 */
export const IMPORT_BLOB_ACCESS = "private" as const;

/** Scratch PDFs live under this per-user prefix; the upload route and the intake action both enforce it. */
export function importBlobPrefix(userId: string): string {
  return `imports/${userId}/`;
}

export type IntakeRejectionCode =
  | "not-pdf"
  | "empty"
  | "too-large"
  | "unreadable"
  | "password-protected"
  | "copy-restricted"
  | "too-many-pages"
  | "scanned"
  | "mostly-scanned"
  | "no-text"
  | "upload-invalid";

export type IntakeRejection = {
  code: IntakeRejectionCode;
  /** Short, human headline — shown as the title of the rejection state. */
  title: string;
  /** One or two plain sentences: what we found, and why it can't go further. */
  message: string;
};

type RejectionContext = {
  pageCount?: number;
  imageOnlyPages?: number;
  imageOnlyApproximate?: boolean;
};

/**
 * Every rejection says what was found and why it stops there — the plan's
 * rule is that a rejected book should be told *why*, not just "invalid file".
 */
export function rejection(code: IntakeRejectionCode, ctx: RejectionContext = {}): IntakeRejection {
  switch (code) {
    case "not-pdf":
      return {
        code,
        title: "That doesn’t look like a PDF",
        message: "Choose the PDF version of your book — a file ending in .pdf.",
      };
    case "empty":
      return {
        code,
        title: "That file is empty",
        message: "It has no content at all. Try exporting the PDF again from wherever you made it.",
      };
    case "too-large":
      return {
        code,
        title: "That file is too large",
        message: `PDFs up to ${IMPORT_MAX_BYTES / (1024 * 1024)} MB can be imported. If yours has very high-resolution images, exporting a smaller version should get it under.`,
      };
    case "unreadable":
      return {
        code,
        title: "We couldn’t open that PDF",
        message:
          "It may be damaged or only partly downloaded. Re-exporting or re-downloading it usually fixes this.",
      };
    case "password-protected":
      return {
        code,
        title: "This PDF is password-protected",
        message:
          "We can’t open it without the password, and we won’t try to get around it. Save an unprotected copy from wherever you made the book, then upload that.",
      };
    case "copy-restricted":
      return {
        code,
        title: "This PDF doesn’t allow its text to be copied",
        message:
          "Its author has turned copying off, and importing needs to read the text. If this is your own book, export a copy without that restriction.",
      };
    case "too-many-pages": {
      const n = ctx.pageCount ?? 0;
      return {
        code,
        title: `This book has ${n} pages`,
        message: `Right now, books up to ${IMPORT_MAX_PAGES} pages can be imported. Anything longer is turned away rather than partly imported, so no part of your book quietly goes missing.`,
      };
    }
    case "scanned":
      return {
        code,
        title: "This looks like a scan",
        message:
          "Its pages are pictures of text, not text itself, so there’s nothing to read chapter by chapter. Importing scanned books isn’t supported yet.",
      };
    case "mostly-scanned": {
      const n = ctx.imageOnlyPages ?? 0;
      const about = ctx.imageOnlyApproximate ? "about " : "";
      return {
        code,
        title: "Most of this book is pictures, not text",
        message: `${about}${n} of its ${ctx.pageCount ?? "?"} pages are images with no readable text. Importing would quietly leave most of the book behind, so it’s stopped here instead. Scanned books aren’t supported yet.`,
      };
    }
    case "no-text":
      return {
        code,
        title: "We couldn’t find any text in this PDF",
        message:
          "Either every page is blank, or the letters were converted to shapes when the PDF was made. Exporting again with live text (not “convert text to outlines”) should fix it.",
      };
    case "upload-invalid":
      return {
        code,
        title: "That upload didn’t go through",
        message: "Something went wrong while sending the file. Please try again.",
      };
  }
}

/** What a passing PDF looks like — shown back to the person and stored on the ImportJob. */
export type IntakeReport = {
  pageCount: number;
  /** Pages with enough real text to count. */
  textPages: number;
  /** Text-less pages that paint an image (illustrations, a cover) — flagged later, never dropped silently. */
  imageOnlyPages: number;
  /** True when imageOnlyPages was extrapolated from a sample rather than counted page by page. */
  imageOnlyApproximate: boolean;
  /** Pages with neither text nor images. */
  blankPages: number;
  /** Encrypted, but opens without a password and allows copying — accepted, and recorded. */
  encrypted: boolean;
};
