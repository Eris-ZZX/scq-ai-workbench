export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.QE_BUILD_PHASE === '1') {
    return;
  }
  const { initializeNodeRuntime } = await import('./instrumentation-node');
  await initializeNodeRuntime();
}

