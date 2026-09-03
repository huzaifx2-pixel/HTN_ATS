export async function register() {
  // Edge must not statically analyze Node-only modules (fs/path/crypto).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { registerNode } = await import("./instrumentation.node");
    await registerNode();
  } catch (error) {
    console.error("[instrumentation] startup failed; continuing without background workers", error);
  }
}
