/** True when the Node process is serving traffic (not compiling static pages). */
export function shouldStartBackgroundWorkers(): boolean {
  if (process.env.NEXT_RUNTIME !== "nodejs") return false;

  const phase = process.env.NEXT_PHASE;
  if (
    phase === "phase-production-build" ||
    phase === "phase-export" ||
    phase === "phase-test"
  ) {
    return false;
  }

  // `next build` workers can still load instrumentation during SSG.
  if (process.env.NEXT_PRIVATE_BUILD_WORKER === "1") return false;

  return true;
}
