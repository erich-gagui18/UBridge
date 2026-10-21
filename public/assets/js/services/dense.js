const DEFAULT_TIMEOUT_MS = 4000;

export function createDenseClient({ url = '', getToken, fetchImpl, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const base = /^https:\/\//i.test(url) ? url.replace(/\/+$/, '') : '';
  const doFetch = (...args) => (fetchImpl || globalThis.fetch)(...args);

  const withTimeout = (work, ms, controller) => {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('timeout'));
      }, ms);
    });
    return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
  };

  async function search(question, expected = {}) {
    if (!base) return null;
    const controller = new AbortController();
    try {
      const token = await getToken?.();
      if (!token) return null;
      const res = await withTimeout(
        doFetch(`${base}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        }),
        timeoutMs,
        controller,
      );
      if (!res.ok) return null;
      const out = await res.json();
      if (!expected.version || !expected.hash) return null;
      if (out.handbookVersion !== expected.version || out.handbookHash !== expected.hash || !Array.isArray(out.hits)) return null;
      return out.hits.map((h) => h?.id).filter((id) => typeof id === 'string');
    } catch {
      return null;
    }
  }

  async function warm() {
    if (!base) return false;
    try {
      const controller = new AbortController();
      const res = await withTimeout(doFetch(`${base}/health`, { signal: controller.signal }), 60000, controller);
      return res.ok;
    } catch {
      return false;
    }
  }

  return { enabled: Boolean(base), search, warm };
}
