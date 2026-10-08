// Per-user localStorage keys, so drafts and history never leak between accounts on a shared computer.
export function createLocal(getUid) {
  const K = (k) => (k === 'theme' ? 'ub.theme' : `ub.${getUid() || 'anon'}.${k}`);
  return {
    load(k, d) {
      try {
        return JSON.parse(localStorage.getItem(K(k))) ?? d;
      } catch {
        return d;
      }
    },
    save: (k, v) => localStorage.setItem(K(k), JSON.stringify(v)),
    drop: (k) => localStorage.removeItem(K(k)),
    clearAllUserData() {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('ub.') && k !== 'ub.theme' && k !== 'ub.privacy')
        .forEach((k) => localStorage.removeItem(k));
    },
  };
}
