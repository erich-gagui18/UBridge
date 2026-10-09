// Course + department pickers that stay in sync (used on the profile page and for the respondent on the complaint form).
//   - pick a course   -> the department fills in by itself
//   - pick a department -> the course list narrows to that department's programs
//   - "Others (not listed)" lets the person type anything, so a missing entry never blocks them
import { esc } from './dom.js';
import { combobox } from './combobox.js';
import { courseLabel } from '../services/academics.js';

const OTHER = 'other';
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Markup for one picker. Ids: {id}Q (search box), {id} (hidden), {id}List, {id}Other (typed text). */
export const pickerHtml = ({ id, label, placeholder, req = true, hint = '' }) =>
  `<div class="field" id="${id}Field"><label${req ? ' class="req"' : ''} for="${id}Q">${esc(label)}</label><div class="cb"><input id="${id}Q" role="combobox" aria-expanded="false" aria-controls="${id}List" aria-autocomplete="list" autocomplete="off" placeholder="${esc(placeholder)}"><ul id="${id}List" class="cb-list" role="listbox" hidden></ul></div><input type="hidden" id="${id}"><input id="${id}Other" class="other-in" maxlength="80" autocomplete="off" placeholder="Type it here" aria-label="${esc(label)} (not listed)" hidden>${hint ? `<p class="hint">${esc(hint)}</p>` : ''}<p class="err"></p></div>`;

/**
 * departments: the catalog from loadAcademics(). ids: {course, dept} are the picker ids (course may be null for faculty).
 * Returns {value(), set({course, dept}), check(), fields}.
 */
export function pairPicker({ $, departments, dept: dId, course: cId = null, onChange }) {
  const courses = departments.flatMap((d) => d.courses.map((c) => ({ id: `${d.id}/${c.id}`, label: courseLabel(c), group: d.name, dept: d.id })));
  const noneItem = (what) => ({ id: OTHER, label: 'Others (not listed)', group: 'Not in the list', hint: `Type your ${what}` });
  const deptItems = [...departments.map((d) => ({ id: d.id, label: d.name, group: '' })), noneItem('department')];
  const courseItemsFor = (deptId) => {
    const list = deptId && deptId !== OTHER ? courses.filter((c) => c.dept === deptId) : courses;
    return [...list, noneItem('course')];
  };

  const el = (id) => ({ q: $('#' + id + 'Q'), h: $('#' + id), list: $('#' + id + 'List'), other: $('#' + id + 'Other') });
  const D = el(dId), C = cId ? el(cId) : null;
  const toggleOther = (x) => { x.other.hidden = x.h.value !== OTHER; if (x.h.value !== OTHER) x.other.value = ''; };

  let dcb, ccb;
  const refreshCourses = () => ccb?.setItems(courseItemsFor(D.h.value));

  dcb = combobox({
    input: D.q, hidden: D.h, list: D.list, items: deptItems, emptyText: 'No department matches. Choose Others to type it.',
    onPick: (o) => {
      toggleOther(D);
      if (o && C && C.h.value && C.h.value !== OTHER) {
        const c = courses.find((x) => x.id === C.h.value);
        if (c && o.id !== OTHER && c.dept !== o.id) { ccb.set(''); toggleOther(C); } // the chosen course belongs elsewhere
      }
      refreshCourses();
      if (o?.id === OTHER) D.other.focus();
      onChange?.();
    },
  });
  if (C) {
    ccb = combobox({
      input: C.q, hidden: C.h, list: C.list, items: courseItemsFor(''), emptyText: 'No course matches. Choose Others to type it.',
      onPick: (o) => {
        toggleOther(C);
        if (o && o.id !== OTHER) { // fill in the department that owns this course
          const d = departments.find((x) => x.id === o.dept);
          if (d && D.h.value !== d.id) { dcb.set(d.id); toggleOther(D); }
          refreshCourses();
        }
        if (o?.id === OTHER) C.other.focus();
        onChange?.();
      },
    });
  }
  [D, C].filter(Boolean).forEach((x) => x.other.addEventListener('input', () => onChange?.()));

  const text = (x, items) => {
    if (!x.h.value) return '';
    if (x.h.value === OTHER) return x.other.value.trim();
    return items.find((i) => i.id === x.h.value)?.label || '';
  };
  const api = {
    value: () => ({ dept: text(D, deptItems), course: C ? text(C, courses) : '' }),
    /** Restore saved text values: a known name picks its entry, anything else goes under Others. */
    set({ dept = '', course = '' } = {}) {
      const dm = departments.find((d) => norm(d.name) === norm(dept));
      const cm = courses.find((c) => norm(c.label) === norm(course));
      const deptId = dm ? dm.id : dept ? OTHER : cm ? cm.dept : '';
      dcb.set(deptId); D.other.value = deptId === OTHER ? dept : ''; toggleOther(D);
      if (C) {
        ccb.setItems(courseItemsFor(deptId));
        const courseId = cm && (deptId === OTHER || cm.dept === deptId) ? cm.id : course ? OTHER : '';
        ccb.set(courseId); C.other.value = courseId === OTHER ? course : ''; toggleOther(C);
      }
    },
    /** Validation messages for what is on screen, or '' when fine. */
    check({ needCourse = true } = {}) {
      const out = {};
      if (!D.h.value) out.dept = 'Choose the department, or Others to type it';
      else if (D.h.value === OTHER && D.other.value.trim().length < 2) out.dept = 'Type the department name';
      if (C && needCourse) {
        if (!C.h.value) out.course = 'Choose the course, or Others to type it';
        else if (C.h.value === OTHER && C.other.value.trim().length < 2) out.course = 'Type the course name';
      }
      return out;
    },
    fields: { D, C },
  };
  return api;
}
