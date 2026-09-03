export async function register() {
  // Keep this file free of Node imports. Netlify's Edge instrumentation
  // analysis fails if fs/path/crypto modules are reachable from here.
  // Background workers still start on Railway/desktop via start-standalone
  // and match-worker scripts; Netlify serverless must not run them.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NETLIFY) return;

  try {
    // Variable module id prevents Edge from statically bundling Node deps.
    const nodeEntry = "./instrumentation" + ".node";
    const mod = await import(nodeEntry);
    await mod.registerNode();
  } catch (error) {
    console.error("[instrumentation] startup failed; continuing without background workers", error);
  }
}
