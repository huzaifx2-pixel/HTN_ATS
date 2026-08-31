import os from "node:os";

/** Prefer a private IPv4 address other machines on the LAN can reach. */
export function detectLanIp(): string | null {
  const nets = os.networkInterfaces();
  const candidates: string[] = [];

  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family !== "IPv4" || addr.internal) continue;
      const ip = addr.address;
      if (
        ip.startsWith("192.168.") ||
        ip.startsWith("10.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
      ) {
        candidates.push(ip);
      }
    }
  }

  return candidates[0] ?? null;
}
