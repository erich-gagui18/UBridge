// Colleges (departments) and their programs, from data/academics.json. Loaded once and cached.
let cache;
export function loadAcademics() {
  cache ||= fetch(new URL('../data/academics.json', import.meta.url))
    .then((r) => {
      if (!r.ok) throw new Error('academics.json not found');
      return r.json();
    })
    .then((j) => j.departments || [])
    .catch(() => []); // the pickers still work: everything can be typed under "Others"
  return cache;
}

/** What is saved on a complaint or profile for a course: "BS Information Technology (BSIT)". */
export const courseLabel = (c) => (c.code ? `${c.name} (${c.code})` : c.name);
