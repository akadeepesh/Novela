import "server-only";
// Importing the worker module first registers it on `globalThis.pdfjsWorker`,
// which pdf.js picks up and runs in-process. That avoids its default
// behaviour of dynamically importing a worker file by a computed path —
// which bundlers and serverless file-tracing can't see, and which is the
// classic "Setting up fake worker failed" deploy-only failure.
import "pdfjs-dist/legacy/build/pdf.worker.mjs";
import { getDocument, OPS, PermissionFlag, Util } from "pdfjs-dist/legacy/build/pdf.mjs";

export { OPS, PermissionFlag, Util };
export type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/types/src/display/api";

/**
 * The one place pdf.js gets configured, shared by intake and extraction so
 * the two can never disagree about how a file is opened. Only reads text and
 * page structure — nothing is ever rendered here.
 */
export function openPdf(bytes: Uint8Array) {
  return getDocument({
    data: bytes,
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  });
}
