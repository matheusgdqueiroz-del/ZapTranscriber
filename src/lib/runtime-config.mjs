const MAX_WASM_THREADS = 4;

export function selectWasmThreadCount(isCrossOriginIsolated, hardwareConcurrency) {
  if (!isCrossOriginIsolated) {
    return 1;
  }

  const logicalProcessors = Number.isFinite(hardwareConcurrency)
    ? Math.max(1, Math.floor(hardwareConcurrency))
    : 2;

  return Math.min(
    MAX_WASM_THREADS,
    Math.max(1, Math.floor(logicalProcessors / 2))
  );
}
