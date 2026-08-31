import net from "node:net";

export async function findAvailablePort(preferred: number, maxAttempts = 50): Promise<number> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const port = preferred + i;
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found starting at ${preferred}`);
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen({ port, host: "127.0.0.1" }, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function waitForHttp(baseUrl: string, timeoutMs = 120_000): Promise<void> {
  const healthUrl = new URL("/api/health", baseUrl).href;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(healthUrl, { method: "GET" });
      if (res.ok) {
        const body = (await res.json()) as { ok?: boolean };
        if (body.ok) return;
      }
    } catch {
      // not ready
    }
    await sleep(500);
  }
  throw new Error(`Backend health check failed at ${healthUrl} within ${timeoutMs}ms`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
