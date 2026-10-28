const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Count a number up (or down) from what the element showed last time. */
export function countUp(el, to, ms = 900, suffix = '') {
  const from = Number(el.dataset.v ?? 0);
  el.dataset.v = to;
  if (reduce() || from === to) {
    el.textContent = to + suffix;
    return;
  }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / ms),
      e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * e) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
/** Give every [data-reveal] element a staggered delay (CSS does the animation). */
export const stagger = (root) =>
  root.querySelectorAll('[data-reveal]').forEach((el, i) => el.style.setProperty('--i', i));
