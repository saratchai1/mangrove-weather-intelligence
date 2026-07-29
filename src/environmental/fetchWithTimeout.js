export async function fetchWithTimeout(
  fetchImpl,
  input,
  init = {},
  timeoutMs = 10000,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`หมดเวลารอผู้ให้บริการหลัง ${timeoutMs} มิลลิวินาที`));
  }, timeoutMs);

  try {
    return await fetchImpl(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
