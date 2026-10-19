import "server-only";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { isObviouslyInternalHost, resolvePublicAddress, type ResolvedTarget } from "@/lib/ssrf-guard";

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
const MAX_REDIRECTS = 3;
const USER_AGENT = "Mozilla/5.0 (compatible; KoraKagajBot/1.0; +https://korakagaj.app/bot)";

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

/** http(s) only, default ports only, no embedded credentials. */
function isAllowedUrl(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const defaultPort = url.protocol === "https:" ? "443" : "80";
  return url.port === "" || url.port === defaultPort;
}

/**
 * One GET that connects ONLY to the already-checked address. The hostname is
 * still used for the Host header and TLS, but the connection can't be
 * redirected to a different IP by a second DNS lookup (DNS rebinding).
 */
function requestPinned(url: URL, target: ResolvedTarget, signal: AbortSignal): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const lookup = ((_host: string, options: { all?: boolean }, cb: (...args: unknown[]) => void) => {
      if (options?.all) cb(null, [{ address: target.address, family: target.family }]);
      else cb(null, target.address, target.family);
    }) as unknown as net.LookupFunction;

    const req = (isHttps ? https : http).request(
      {
        host,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        signal,
        lookup,
        servername: isHttps && !net.isIP(host) ? host : undefined,
        headers: {
          // A plain fetch UA gets blocked by some sites' bot filters far
          // more often than a browser-shaped one.
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Encoding": "identity",
        },
      },
      resolve
    );
    req.on("error", reject);
    req.end();
  });
}

/** An og:image URL is only ever handed to the browser, but still: https, public-looking host. */
function isSafeImageUrl(imageUrl: string): boolean {
  try {
    const u = new URL(imageUrl);
    return u.protocol === "https:" && !u.username && !isObviouslyInternalHost(u.hostname);
  } catch {
    return false;
  }
}

export async function fetchUrlPreview(rawUrl: string): Promise<UrlPreview | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isAllowedUrl(url)) return null;
  const firstTarget = await resolvePublicAddress(url.hostname);
  if (!firstTarget) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // Follow redirects by hand: every hop is re-validated and re-resolved, so
    // a public page can't bounce us to an internal address.
    let current = url;
    let target = firstTarget;
    let res = await requestPinned(current, target, controller.signal);
    for (let hop = 0; ; hop++) {
      const status = res.statusCode ?? 0;
      const location = res.headers.location;
      if (status < 300 || status >= 400 || !location) break;
      res.destroy();
      if (hop >= MAX_REDIRECTS) return fallbackPreview(url);
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return fallbackPreview(url);
      }
      if (!isAllowedUrl(next)) return fallbackPreview(url);
      const nextTarget = await resolvePublicAddress(next.hostname);
      if (!nextTarget) return fallbackPreview(url);
      current = next;
      target = nextTarget;
      res = await requestPinned(current, target, controller.signal);
    }

    const contentType = String(res.headers["content-type"] ?? "");
    const ok = (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300;
    if (!ok || !contentType.includes("text/html")) {
      res.destroy();
      return fallbackPreview(url);
    }

    const chunks: Buffer[] = [];
    let received = 0;
    for await (const chunk of res) {
      const buf = chunk as Buffer;
      chunks.push(buf);
      received += buf.byteLength;
      if (received >= MAX_BYTES) break;
    }
    res.destroy();

    const html = Buffer.concat(chunks).toString("utf-8");
    const meta = collectMetaTags(html);

    const rawTitle =
      meta.get("og:title") || meta.get("twitter:title") || extractTitleTag(html) || url.hostname;
    const rawDescription = meta.get("og:description") || meta.get("description") || "";
    const rawSiteName = meta.get("og:site_name") || url.hostname.replace(/^www\./, "");

    let imageUrl = meta.get("og:image") || meta.get("twitter:image") || "";
    if (imageUrl) {
      try {
        imageUrl = new URL(imageUrl, current.toString()).toString();
      } catch {
        imageUrl = "";
      }
      if (imageUrl && !isSafeImageUrl(imageUrl)) imageUrl = "";
    }

    return {
      title: decodeHtmlEntities(rawTitle).slice(0, 160),
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
