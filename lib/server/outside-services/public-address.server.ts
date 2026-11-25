import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

// Whether a host is on the public internet, so the server can fetch a URL
// someone typed without being made to ask something of its own network:
// a loopback, private, link-local (as cloud metadata services are) or other
// special-use address. The ranges are IANA's special-purpose registries'
// that aren't globally reachable:
// https://www.iana.org/assignments/iana-ipv4-special-registry/
// https://www.iana.org/assignments/iana-ipv6-special-registry/

const INTERNAL = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  INTERNAL.addSubnet(network, prefix, "ipv4");
}
// An IPv4 address written as IPv6 (::ffff:10.0.0.1) is checked by the IPv4 ranges above.
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  INTERNAL.addSubnet(network, prefix, "ipv6");
}

/** Whether an IP address, v4 or v6, is on the public internet. */
export function isPublicIp(ip: string): boolean {
  return !INTERNAL.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
}

/**
 * Whether a URL's host is on the public internet: an IP address that is, or
 * a name every address of which is. False for a name that doesn't resolve.
 */
export async function isPublicHost(hostname: string): Promise<boolean> {
  const bare = hostname.replace(/^\[(.*)\]$/, "$1");
  const addresses = isIP(bare)
    ? [bare]
    : await lookup(bare, { all: true }).then(
        (found) => found.map(({ address }) => address),
        () => [],
      );
  return addresses.length > 0 && addresses.every(isPublicIp);
}
