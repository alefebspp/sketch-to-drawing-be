const MAX_PERSISTED_ERROR_LENGTH = 2000;

/**
 * Resumo seguro de erro para `drawings.last_error`: mensagem + stack encurtada, sem
 * vazar prompts ou conteúdo arbitrário além do que já está em `Error`.
 */
export function formatDrawingImageJobErrorForPersistence(err: Error): string {
  const name = err.name || "Error";
  const message = (err.message ?? "").trim() || "(no message)";
  let out = `${name}: ${message}`;
  if (err.stack) {
    out += `\n\n${err.stack.trim()}`;
  }
  if (out.length <= MAX_PERSISTED_ERROR_LENGTH) {
    return out;
  }
  return `${out.slice(0, MAX_PERSISTED_ERROR_LENGTH)}…`;
}
