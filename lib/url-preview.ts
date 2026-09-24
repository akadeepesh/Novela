import "server-only";

/**
 * Fetches enough of a page's <head> to build a bookmark-card preview:
 * title, description, a preview image, a favicon, and the site name.
 * Used by the Research board's URL-paste composer (Part 7.2) so pasting a
 * link is enough — no form to fill in.
 */

export type UrlPreview = {
  title: string;
  description: string;
  imageUrl: string;
  faviconUrl: string;
  siteName: string;
};

const FETCH_TIMEOUT_MS = 6000;
// Most og/meta tags live in <head>, which is almost always well within
// this — no reason to pull an entire (possibly huge) page over the wire.
const MAX_BYTES = 300_000;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0" || h === "::1") return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (h === "169.254.169.254") return true; // cloud metadata endpoint
  return false;
}

function faviconFor(hostname: string): string {
  return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(hostname)}`;
}

function fallbackPreview(url: URL): UrlPreview {
  return {
    title: url.hostname,
    description: "",
    imageUrl: "",
    faviconUrl: faviconFor(url.hostname),
    siteName: url.hostname.replace(/^www\./, ""),
  };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/**
 * Parses every <meta> tag in the given HTML into a name/property -> content
 * map. Written as a small hand-rolled scanner (no cheerio/jsdom dependency)
 * since attribute order (`property` before `content` or after) varies
 * across sites and a plain regex-per-tag approach handles that fine.
 */
function collectMetaTags(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const tagRe = /<meta\b[^>]*>/gi;
  const attrRe = /([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"|([a-zA-Z][\w:-]*)\s*=\s*'([^']*)'/g;

  for (const tagMatch of html.matchAll(tagRe)) {
    const tag = tagMatch[0];
    const attrs: Record<string, string> = {};
    for (const attrMatch of tag.matchAll(attrRe)) {
      const key = (attrMatch[1] ?? attrMatch[3])?.toLowerCase();
      const value = attrMatch[2] ?? attrMatch[4] ?? "";
      if (key) attrs[key] = value;
    }
    const key = attrs.property || attrs.name;
    if (key && attrs.content !== undefined && !map.has(key.toLowerCase())) {
      map.set(key.toLowerCase(), attrs.content);
    }
  }
  return map;
}

function extractTitleTag(html: string): string {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match?.[1]?.trim() ?? "";
}

export async function fetchUrlPreview(rawUrl: string): Promise<UrlPreview | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (isBlockedHost(url.hostname)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // A plain fetch UA gets blocked by some sites' bot filters far
        // more often than a browser-shaped one.
        "User-Agent":
          "Mozilla/5.0 (compatible; KoraKagajBot/1.0; +https://korakagaj.app/bot)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !res.body || !contentType.includes("text/html")) {
      return fallbackPreview(url);
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
      }
    }
    reader.cancel().catch(() => {});

    const html = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
    const meta = collectMetaTags(html);

    const rawTitle =
      meta.get("og:title") || meta.get("twitter:title") || extractTitleTag(html) || url.hostname;
    const rawDescription = meta.get("og:description") || meta.get("description") || "";
    const rawSiteName = meta.get("og:site_name") || url.hostname.replace(/^www\./, "");

    let imageUrl = meta.get("og:image") || meta.get("twitter:image") || "";
    if (imageUrl) {
      try {
        imageUrl = new URL(imageUrl, url.toString()).toString();
        if (isBlockedHost(new URL(imageUrl).hostname)) imageUrl = "";
      } catch {
        imageUrl = "";
      }
    }

    return {
      title: decodeHtmlEntities(rawTitle).slice(0, 200),
      description: decodeHtmlEntities(rawDescription).slice(0, 500),
      imageUrl,
      faviconUrl: faviconFor(url.hostname),
      siteName: decodeHtmlEntities(rawSiteName).slice(0, 100),
    };
  } catch {
    return fallbackPreview(url);
  } finally {
    clearTimeout(timeout);
  }
}
