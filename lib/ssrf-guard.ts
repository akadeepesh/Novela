import dns from "node:dns/promises";
import net from "node:net";

/**
 * SSRF protection for anything the server fetches on a person's behalf.
 * A hostname check alone is not enough (DNS can point a public-looking name at
 * a private address, and short/odd IP spellings slip through string checks),
 * so we resolve the name ourselves and judge the ADDRESSES.
 */

const blocked = new net.BlockList();
const V4: [string, number][] = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];
const V6: [string, number][] = [
  ["::", 96], // unspecified, loopback, IPv4-compatible
  ["64:ff9b::", 96], // NAT64
  ["64:ff9b:1::", 48], // local-use NAT64
  ["100::", 64], // discard-only
  ["2001::", 32], // Teredo
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local (deprecated)
  ["ff00::", 8], // multicast
];
for (const [addr, prefix] of V4) blocked.addSubnet(addr, prefix, "ipv4");
for (const [addr, prefix] of V6) blocked.addSubnet(addr, prefix, "ipv6");

/** True only for a syntactically valid IP that is not in any reserved range. */
export function isPublicIp(ip: string): boolean {
  if (ip.includes("%")) return false; // IPv6 zone ids
  const family = net.isIP(ip);
  if (family === 0) return false;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d): a public host never resolves to this
  // form, so treat it as hostile. (It can't go in the BlockList: Node checks
  // plain IPv4 addresses as mapped IPv6, so that rule would match all of them.)
  if (family === 6 && ip.toLowerCase().startsWith("::ffff:")) return false;
  return !blocked.check(ip, family === 4 ? "ipv4" : "ipv6");
}

// Names that are internal by convention, whatever DNS says.
const INTERNAL_NAME = /(^|\.)(localhost|local|internal|localdomain|home\.arpa|lan|intranet)$/;

function cleanHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
}

/**
 * Cheap, synchronous check for values we never fetch ourselves (e.g. an
 * og:image URL we only hand to the browser): is this host obviously internal?
 */
export function isObviouslyInternalHost(hostname: string): boolean {
  const host = cleanHost(hostname);
  if (!host) return true;
  if (net.isIP(host)) return !isPublicIp(host);
  return INTERNAL_NAME.test(host) || !host.includes(".");
}

export type ResolvedTarget = { address: string; family: 4 | 6 };

/**
 * Resolves a hostname and returns the address to connect to, or null if the
 * host is internal or ANY of its addresses is reserved. The caller must
 * connect to the returned address (not re-resolve), otherwise DNS rebinding
 * could swap in a private address between this check and the connection.
 */
export async function resolvePublicAddress(
  hostname: string,
  lookup: typeof dns.lookup = dns.lookup
): Promise<ResolvedTarget | null> {
  const host = cleanHost(hostname);
  if (!host) return null;

  const literal = net.isIP(host);
  if (literal) {
    return isPublicIp(host) ? { address: host, family: literal as 4 | 6 } : null;
  }
  if (INTERNAL_NAME.test(host) || !host.includes(".")) return null;

  let results: { address: string; family: number }[];
  try {
    results = await lookup(host, { all: true, verbatim: true });
  } catch {
    return null;
  }
  if (results.length === 0 || results.some((r) => !isPublicIp(r.address))) return null;
  return { address: results[0].address, family: results[0].family === 6 ? 6 : 4 };
}
