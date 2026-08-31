const BASE = "http://localhost:3000";

async function login() {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE,
      referer: `${BASE}/login`,
    },
    body: JSON.stringify({ email: "demo@headsbase.com", password: "demo12345" }),
  });
  const set = res.headers.getSetCookie?.() ?? [];
  const jar = new Map<string, string>();
  for (const raw of set) {
    const part = raw.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function load(path: string, cookie: string, label: string) {
  const start = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie, accept: "text/html" },
    redirect: "manual",
  });
  const ttfb = Math.round(performance.now() - start);
  await res.arrayBuffer();
  const total = Math.round(performance.now() - start);
  return { label, status: res.status, ttfbMs: ttfb, totalMs: total };
}

async function main() {
  const cookie = await login();
  await load("/dashboard", cookie, "warm");
  await new Promise((r) => setTimeout(r, 500));
  const dashboard = await load("/dashboard", cookie, "measure");
  const perf = await (await fetch(`${BASE}/api/admin/perf`, { headers: { cookie, origin: BASE } })).json();

  console.info(
    JSON.stringify(
      {
        dashboardTtfbMs: dashboard.ttfbMs,
        pages: perf.pages?.filter((p: { page: string }) => p.page.startsWith("dashboard")),
        watched: perf.watched?.filter((w: { label: string }) => w.label.includes("dashboard")),
        top10: perf.top10?.filter((t: { label: string }) => t.label.includes("dashboard")),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
