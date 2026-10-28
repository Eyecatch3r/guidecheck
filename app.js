// Guidecheck review interface. No build step, no dependencies except marked (Markdown).
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fetchText = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.text() : null)).catch(() => null);
const fetchJSON = async (u) => { const t = await fetchText(u); try { return t ? JSON.parse(t) : null; } catch { return null; } };

const ICON = {
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>',
  x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  pen: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 2.5l3 3L6 13l-3.5.5L3 10z"/></svg>',
  copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M10.5 3.5v-1h-8v8h1"/></svg>',
  undo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 3L2.5 6l3 3"/><path d="M2.5 6H10a3.5 3.5 0 010 7H7"/></svg>',
  warn: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2l6.5 11.5h-13z"/><path d="M8 6.5v3M8 11.6v.1"/></svg>',
  doc: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M4 1.5h5.5l3 3v10h-8.5z"/><path d="M9.5 1.5v3h3"/></svg>',
  up: '<svgviewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10l4-4 4 4"/></svg>',
  down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg>',
};

const VERDICT = {
  current: ['Current', 'No substantive update is necessary.'],
  minor: ['Minor update', 'Current with minor updates: mainly new references and context.'],
  substantive: ['Substantive update', 'Requires substantive updating: important developments must be added.'],
  structural: ['Structural revision', 'Outdated in important respects: substantial revision is necessary.'],
  superseded: ['Fundamentally superseded', 'The central framework or conclusions are overtaken by later research.'],
};
const LEVEL = { reference: 'Reference-level updating', substantive: 'Substantive updating', structural: 'Structural revision', conceptual: 'Conceptual reconceptualization' };
const SOURCE_TYPE = { 'peer-reviewed': 'Peer-reviewed', preprint: 'Preprint', book: 'Book or chapter', report: 'Report', standard: 'Standard', regulation: 'Regulation', editorial: 'Editorial', other: 'Other' };
const MARK = { approved: 'OK', rejected: 'stet', edited: 'amended' };
// Two kinds of finding. A correction fixes an error of form in the text. A comment is anchored to a passage and leaves the text as it is.
const isComment = (c) => c.type === 'comment';
const TYPE = { comment: 'Comment', correction: 'Correction' };
// Archive file name of a DOI. Same rule as openalex.mjs.
const pdfName = (doi) => doi.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/[^a-z0-9.-]+/g, '_') + '.pdf';

const S = {
  runs: [], library: new Set(), writable: false, run: null, original: '', report: '', dec: {},
  i: 0, tab: 'changes', split: false, editing: false, fresh: null,
  filter: { type: 'all', status: 'all', sig: 'all' }, reviewer: '',
};

// ---------- Diff (word level, longest common subsequence) ----------
const tok = (s) => s.match(/\s+|[^\s]+/g) || [];
function diff(a, b) {
  const A = tok(a), B = tok(b);
  let p = 0; while (p < A.length && p < B.length && A[p] === B[p]) p++;
  let q = 0; while (q < A.length - p && q < B.length - p && A[A.length - 1 - q] === B[B.length - 1 - q]) q++;
  const a2 = A.slice(p, A.length - q), b2 = B.slice(p, B.length - q), n = a2.length, m = b2.length;
  const ops = [];
  const push = (t, s) => { const last = ops[ops.length - 1]; if (last && last.t === t) last.s += s; else ops.push({ t, s }); };
  A.slice(0, p).forEach((s) => push('=', s));
  if (n * m > 4e6) { a2.forEach((s) => push('-', s)); b2.forEach((s) => push('+', s)); }
  else {
    const L = new Uint32Array((n + 1) * (m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      L[i * (m + 1) + j] = a2[i] === b2[j] ? L[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(L[(i + 1) * (m + 1) + j], L[i * (m + 1) + j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a2[i] === b2[j]) { push('=', a2[i]); i++; j++; }
      else if (L[(i + 1) * (m + 1) + j] >= L[i * (m + 1) + j + 1]) push('-', a2[i++]);
      else push('+', b2[j++]);
    }
    while (i < n) push('-', a2[i++]);
    while (j < m) push('+', b2[j++]);
  }
  A.slice(A.length - q).forEach((s) => push('=', s));
  // Group into unchanged runs and edits ({d: deleted, i: inserted}).
  const items = [];
  for (const o of ops) {
    const last = items[items.length - 1];
    if (o.t === '=') items.push({ s: o.s });
    else if (last && last.s === undefined) last[o.t === '-' ? 'd' : 'i'] += o.s;
    else items.push(o.t === '-' ? { d: o.s, i: '' } : { d: '', i: o.s });
  }
  // Semantic cleanup: an unchanged run that is not longer than the edits on both sides is noise.
  // Fold it into one phrase-level edit, so shared phrases stay set text and edits read as whole phrases.
  const size = (e) => Math.max(e.d.length, e.i.length);
  for (let changed = true; changed;) {
    changed = false;
    for (let k = 1; k < items.length - 1; k++) {
      const [l, eq, r] = [items[k - 1], items[k], items[k + 1]];
      if (eq.s === undefined || l.s !== undefined || r.s !== undefined) continue;
      if (eq.s.trim() && (eq.s.length > size(l) || eq.s.length > size(r))) continue;
      items.splice(k - 1, 3, { d: l.d + eq.s + r.d, i: l.i + eq.s + r.i });
      changed = true;
    }
  }
  return items.flatMap((x) => (x.s !== undefined ? [{ t: '=', s: x.s }] : [x.d && { t: '-', s: x.d }, x.i && { t: '+', s: x.i }].filter(Boolean)));
}
// Proof convention: a struck passage is removed; a caret marks where new text goes in.
const markup = (ops, ink, side) => ops.map((o) => {
  if (o.t === '=') return esc(o.s);
  if (o.t === '-' && side !== 'new') return `<del class="pm-del ink-${ink}">${esc(o.s)}</del>`;
  if (o.t === '+' && side !== 'old') return `<ins class="pm-ins ink-${ink}${side ? '' : ' caret'}">${esc(o.s)}</ins>`;
  return '';
}).join('');

// Galley margin: line numbers in original.md, proof marks, and the reviewer's ringed answer.
const lineOf = (c) => S.original.slice(0, c.at).split('\n').length;
const lineRange = (c) => { const a = lineOf(c), b = a + (c.original.match(/\n/g) || []).length; return a === b ? `l. ${a}` : `ll. ${a}–${b}`; };
const PROOF = {
  caret: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 12L7 3l5 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  query: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 2.5h9v6.5h-5L4 11.5V9H2.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  dele: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 3c3 0 5 1 6 4s1 5 3 5c1.5 0 2-1.5 1-2.5S8.5 9 7 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};
function marginMarks(ops) {
  const del = ops.filter((o) => o.t === '-').length, ins = ops.filter((o) => o.t === '+').length;
  return `${del ? `<span class="pmark" title="${del} deletion(s)">${PROOF.dele}<span class="num">${del}</span></span>` : ''}${ins ? `<span class="pmark" title="${ins} insertion(s)">${PROOF.caret}<span class="num">${ins}</span></span>` : ''}`;
}
const ring = (word, fresh) => `<span class="ring${fresh ? ' fresh' : ''}"><svg viewBox="0 0 84 38" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M10 22C6 10 30 4 50 5s30 8 26 20-38 12-58 7C6 30 4 18 16 11"/></svg><span>${word}</span></span>`;

// ---------- Markdown ----------
const md = (s) => {
  if (!window.marked) return `<p>${esc(s).replace(/\n{2,}/g, '</p><p>')}</p>`;
  return window.marked.parse(s, { async: false });
};
if (window.marked) window.marked.use({ renderer: { html: (t) => esc(typeof t === 'string' ? t : t.text) } });

// ---------- Decisions ----------
const D = (id) => S.dec[id] || { status: 'pending' };
const draftKey = () => `guidecheck:${S.run.guide}/${S.run.runId}`;
// Only corrections change the text. An accepted comment goes to the Word master through Copy comment.
const textFor = (c) => { const d = D(c.id); if (isComment(c)) return c.original; return d.status === 'approved' ? c.proposed : d.status === 'edited' ? d.text : c.original; };
const wording = (c) => { const d = D(c.id); return d.status === 'edited' ? d.text : c.suggestion; };

function revised() {
  let out = '', pos = 0;
  for (const c of S.run.changes) {
    if (c.at < 0) continue;
    out += S.original.slice(pos, c.at) + textFor(c);
    pos = c.at + c.original.length;
  }
  return out + S.original.slice(pos);
}
const payload = () => ({ guide: S.run.guide, runId: S.run.runId, reviewer: S.reviewer, updatedAt: new Date().toISOString(), decisions: S.dec });

let saveTimer;
function persist() {
  try { localStorage.setItem(draftKey(), JSON.stringify(payload())); } catch { /* storage blocked: the server copy still saves */ }
  if (!S.writable) return setSave('local');
  setSave('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const r = await fetch('api/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guide: S.run.guide, runId: S.run.runId, decisions: payload(), revised: revised() }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || r.statusText);
      setSave('saved', new Date(body.savedAt));
    } catch (e) { setSave('error', e.message); }
  }, 450);
}
function setSave(state, info) {
  const el = $('#saveState');
  el.dataset.state = state;
  el.textContent = {
    local: 'Kept in this browser',
    saving: 'Saving…',
    saved: `Saved to repository ${info ? info.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`,
    error: `Not saved: ${info}. Decisions are kept in this browser.`,
    idle: S.writable ? 'Connected to repository' : 'Read-only copy',
  }[state];
}

function decide(status, extra = {}) {
  const c = current(); if (!c || c.at < 0) return;
  const prev = D(c.id);
  if (status === 'pending') delete S.dec[c.id];
  else S.dec[c.id] = { status, note: prev.note || '', ...extra, by: S.reviewer || undefined, at: new Date().toISOString() };
  S.fresh = status === 'pending' ? null : c.id;
  S.editing = false;
  persist();
  let target = S.i;
  if (status === 'approved' || status === 'rejected' || status === 'edited') {
    const next = visible().find((x, k) => k > visibleIndex() && D(x.c.id).status === 'pending')
      || visible().find((x) => D(x.c.id).status === 'pending' && x.c.id !== c.id);
    if (next) target = next.i;
  }
  vt(target > S.i ? 'next' : target < S.i ? 'prev' : 'same', () => { S.i = target; render(); toTop(); });
}

// ---------- Selection and filters ----------
const current = () => S.run?.changes[S.i];
const visible = () => S.run.changes.map((c, i) => ({ c, i })).filter(({ c }) => {
  const st = D(c.id).status;
  if (S.filter.type !== 'all' && c.type !== S.filter.type) return false;
  if (S.filter.status === 'pending' && st !== 'pending') return false;
  if (S.filter.status === 'decided' && st === 'pending') return false;
  if (S.filter.sig !== 'all' && c.significance !== S.filter.sig) return false;
  return true;
});
const visibleIndex = () => visible().findIndex((x) => x.i === S.i);
function step(d) {
  const v = visible(); if (!v.length) return;
  const k = visibleIndex();
  const next = v[Math.min(v.length - 1, Math.max(0, (k < 0 ? 0 : k + d)))];
  select(next.i);
}
function select(i) {
  vt(i > S.i ? 'next' : i < S.i ? 'prev' : 'same', () => { S.i = i; S.editing = false; S.fresh = null; render(); toTop(); });
  $(`.changes [data-i="${i}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

// ---------- Motion ----------
// View transitions move the sheet in the direction of travel. No support or reduced motion: instant update.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function vt(kind, update) {
  if (!document.startViewTransition || reduced.matches || !S.run) return update();
  const root = document.documentElement;
  root.dataset.vt = kind;
  const t = document.startViewTransition(update);
  t.finished.finally(() => { if (root.dataset.vt === kind) delete root.dataset.vt; });
  return t.updateCallbackDone;
}
// s3 and c7 in agent prose become buttons that open that source or change. Unknown IDs stay plain text.
const refs = (t) => esc(t).replace(/\b([sc])(\d+)\b/g, (m, k) =>
  (k === 's' ? S.run.sources : S.run.changes).some((x) => x.id === m)
    ? `<button type="button" class="ref" data-ref="${m}" title="${k === 's' ? 'Show source' : 'Open change'} ${m}">${m}</button>` : m);
async function follow(id) {
  if (id[0] === 'c') { S.tab = 'changes'; return select(S.run.changes.findIndex((c) => c.id === id)); }
  // The sources column lists only the sources of the current change. Other sources are in the Assessment tab.
  if (!$(`#src-${id}`)) await vt('tab', () => { S.tab = 'assessment'; render(); });
  const el = $(`#src-${id}`);
  el.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'center' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}
// A new change starts at its top: the desk column scrolls on wide screens, the page on narrow ones.
function toTop() {
  const desk = $('.desk'), sheet = $('#sheet');
  if (desk) desk.scrollTop = 0;
  if (sheet && sheet.getBoundingClientRect().top < 0) sheet.scrollIntoView();
}
// The list cursor glides to the current change instead of jumping.
function placeCursor() {
  const ul = $('#changeList'), li = ul.querySelector('[aria-current="true"]')?.parentElement;
  ul.style.setProperty('--cur-o', li ? 1 : 0);
  if (li) for (const [k, v] of [['x', li.offsetLeft], ['y', li.offsetTop], ['w', li.offsetWidth], ['h', li.offsetHeight]]) ul.style.setProperty(`--cur-${k}`, v + 'px');
  if (!ul.classList.contains('ready')) requestAnimationFrame(() => ul.classList.add('ready'));
}

// ---------- Load ----------
async function init() {
  S.reviewer = (() => { try { return localStorage.getItem('guidecheck:reviewer') || ''; } catch { return ''; } })();
  $('#reviewer').value = S.reviewer;
  S.writable = await fetch('api/status', { cache: 'no-store' }).then((r) => r.ok && r.headers.get('content-type')?.includes('json')).catch(() => false);
  S.runs = (await fetchJSON('runs/index.json'))?.runs || [];
  S.library = new Set((await fetchJSON('library/index.json'))?.files || []);
  if (!S.runs.length) return showState('No runs yet', `<p>Ask your agent to check a guide. In Claude Code, type:</p><pre>/check-guide &lt;guide&gt;</pre><p>In Codex, write: <q>Run an update check on guides/&lt;guide&gt;. Obey AGENTS.md.</q> Then reload this page.</p>`);
  const sel = $('#runSelect');
  const groups = Map.groupBy ? Map.groupBy(S.runs, (r) => r.guideTitle) : S.runs.reduce((m, r) => m.set(r.guideTitle, [...(m.get(r.guideTitle) || []), r]), new Map());
  sel.innerHTML = [...groups].map(([title, runs]) => `<optgroup label="${esc(title)}">${runs.map((r) =>
    `<option value="${esc(r.guide)}/${esc(r.runId)}">${esc(title)} · ${esc(r.runId)} · ${r.decided}/${r.changes}</option>`).join('')}</optgroup>`).join('');
  bind();
  route();
}

async function route() {
  const [guide, runId, cid] = decodeURIComponent(location.hash.slice(1)).split('/');
  const target = S.runs.find((r) => r.guide === guide && r.runId === runId) || S.runs[0];
  if (!S.run || S.run.guide !== target.guide || S.run.runId !== target.runId) await openRun(target.guide, target.runId);
  const i = S.run.changes.findIndex((c) => c.id === cid);
  if (i >= 0) S.i = i;
  render();
}

async function openRun(guide, runId) {
  const base = `runs/${guide}/${runId}/`;
  showState('Opening run…', '');
  const [run, original, report, file] = await Promise.all([fetchJSON(base + 'run.json'), fetchText(base + 'original.md'), fetchText(base + 'report.md'), fetchJSON(base + 'decisions.json')]);
  if (!run || original == null) return showState('This run cannot be opened', `<p>The interface could not read <code>${esc(base)}run.json</code> or <code>original.md</code>. Run this command to find the problem:</p><pre>node server.mjs --check ${esc(base)}</pre>`);
  run.guide = guide; run.runId = runId;
  run.changes.forEach((c) => {
    // Version 1 runs have no type: every change is a comment, its rationale is the comment, its proposed text the suggested wording.
    if (!c.type) Object.assign(c, { type: 'comment', comment: c.rationale, suggestion: c.proposed });
    c.at = original.indexOf(c.original);
  });
  run.changes.sort((a, b) => (a.at < 0) - (b.at < 0) || a.at - b.at);
  S.run = run; S.original = original; S.report = report || ''; S.i = 0; S.editing = false;
  S.dec = file?.decisions || {};
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey()) || 'null');
    if (draft && (!file || draft.updatedAt > (file.updatedAt || ''))) S.dec = draft.decisions || {};
  } catch { /* no draft */ }
  $('#runSelect').value = `${guide}/${runId}`;
  setSave('idle');
}

function showState(title, html) {
  for (const v of ['#viewChanges', '#viewAssessment', '#viewFull']) $(v).hidden = true;
  const st = $('#viewState'); st.hidden = false;
  st.innerHTML = `<div class="state"><h2>${esc(title)}</h2>${html}</div>`;
}

// ---------- Render ----------
function render() {
  if (!S.run) return;
  const run = S.run, decided = run.changes.filter((c) => D(c.id).status !== 'pending').length;
  $('#viewState').hidden = true;
  $('#progress').innerHTML = `<b class="num">${decided}</b> of <span class="num">${run.changes.length}</span> decided`;
  $('#stripTitle').innerHTML = `<h1>${esc(S.runs.find((r) => r.guide === run.guide)?.guideTitle || run.guide)}</h1>
    <span>${esc(run.runId)} · ${esc(run.agent)}</span>${run.synthetic ? '<span class="tag-demo">Demo data</span>' : ''}`;
  for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === S.tab));
  $('#viewChanges').hidden = S.tab !== 'changes';
  $('#viewAssessment').hidden = S.tab !== 'assessment';
  $('#viewFull').hidden = S.tab !== 'full';
  if (S.tab === 'changes') { renderList(); renderSheet(); renderSources(); }
  if (S.tab === 'assessment') renderAssessment();
  if (S.tab === 'full') renderFull();
  const c = current();
  const hash = `#${run.guide}/${run.runId}${c ? '/' + c.id : ''}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
  sizeNotice();
}

const no = (c) => c.id.replace(/^c(\d+)$/, (_, n) => 'C' + n.padStart(2, '0'));

function renderList() {
  const all = S.run.changes, n = (t) => all.filter((c) => t === 'all' || c.type === t).length;
  $('#filterType').innerHTML = ['all', 'comment', 'correction'].map((t) =>
    `<button data-type="${t}" aria-pressed="${S.filter.type === t}" ${t !== 'all' && !n(t) ? 'disabled' : ''}>${t === 'all' ? 'All' : TYPE[t] + 's'} <span class="num">${n(t)}</span></button>`).join('');
  const v = visible();
  $('#changeList').innerHTML = v.length ? v.map(({ c, i }) => {
    const st = D(c.id).status;
    const weak = isComment(c) && c.significance !== 'incremental' && !c.sources?.length;
    return `<li><button data-i="${i}" aria-current="${i === S.i}">
      <span class="no">${no(c)}</span>
      ${isComment(c) ? `<span class="dot ${esc(c.significance)}" title="Comment, ${esc(c.significance)}"></span>` : `<span class="glyph" title="Correction">${PROOF.caret}</span>`}
      <span class="t">${esc(c.title)}</span>
      <span class="mark${S.fresh === c.id ? ' fresh' : ''}">${MARK[st] || (c.at < 0 ? '<span class="warn">Text missing</span>' : weak ? '<span class="warn">No source</span>' : '')}</span>
      <span class="sec">${esc(c.section)}</span></button></li>`;
  }).join('') : '<li class="empty-list">No change matches these filters.</li>';
  // Narrow screens show the list as a horizontal strip: keep the current change in view.
  const ul = $('#changeList'), cur = ul.querySelector('[aria-current="true"]');
  if (cur && ul.scrollWidth > ul.clientWidth) ul.scrollTo({ left: cur.parentElement.offsetLeft - 16, behavior: reduced.matches ? 'auto' : 'smooth' });
  placeCursor();
}

function renderSheet() {
  const c = current(), el = $('#sheet');
  if (!c) { el.innerHTML = '<p class="empty-list">This run has no changes.</p>'; return; }
  const d = D(c.id), k = S.run.changes.indexOf(c) + 1, com = isComment(c);
  el.innerHTML = `
    <span class="slug-no">${no(c)}</span>
    <div class="slug">
      <span class="type">${com ? PROOF.query : PROOF.caret}${TYPE[c.type]}</span>
      ${com ? `<span class="sep"></span><span class="sig"><span class="dot ${esc(c.significance)}"></span>${esc(c.significance)}</span><span class="sep"></span>
      <span class="cap">${esc(c.direction)}</span><span class="sep"></span>
      <span class="cap">${esc(c.priority)}</span>
      ${c.kind ? `<span class="sep"></span><span class="cap">${esc(c.kind)}</span>` : ''}` : ''}
      <span class="pos"><button class="btn quiet" data-act="prev" aria-label="Previous change (K)" title="Previous change (K)">${ICON.up}</button><span class="num">${k} / ${S.run.changes.length}</span><button class="btn quiet" data-act="next" aria-label="Next change (J)" title="Next change (J)">${ICON.down}</button></span>
    </div>
    <h1 class="change-title">${esc(c.title)}</h1>
    <p class="change-sec">${esc(c.section)}</p>
    ${c.at < 0 ? `<p class="anchor-error">The ${com ? 'anchor' : 'original'} text of this ${com ? 'comment' : 'correction'} is not in <code>original.md</code>. ${com ? 'The comment has no place in the guide.' : 'The correction cannot be applied.'} Ask the agent to correct it, then run <code>node server.mjs --check</code>.</p>` : ''}
    ${com ? commentBody(c, d) : correctionBody(c, d)}
    ${S.editing ? '' : decideBar(c, d)}`;
  if (S.editing) { const t = $('#editText'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
}

const diffbar = (legend = true) => `<div class="diffbar">
  <div class="seg" role="group" aria-label="Diff layout">
    <button data-split="0" aria-pressed="${!S.split}">Marked text</button><button data-split="1" aria-pressed="${S.split}">Side by side</button>
  </div>
  ${legend ? `<div class="legend"><span><del class="pm-del ink-agent">struck</del> removed</span><span><ins class="pm-ins ink-agent">blue</ins> added by agent</span><span><ins class="pm-ins ink-reviewer">red</ins> your edit</span></div>` : ''}
</div>`;
const editor = (value, label) => `<div class="editor">
  <label for="editText">${label} The marks above update as you type.</label>
  <textarea id="editText" spellcheck="true">${esc(value)}</textarea>
  <div class="row"><button class="btn primary" data-act="saveEdit">${ICON.check}Save edit <kbd>Ctrl+Enter</kbd></button><button class="btn quiet" data-act="cancelEdit">Cancel <kbd>Esc</kbd></button></div>
</div>`;

function correctionBody(c, d) {
  const after = d.status === 'edited' ? d.text : c.proposed;
  let body;
  if (S.editing) body = galley(c.original, $('#editText')?.value ?? after, 'reviewer');
  else if (d.status === 'rejected') body = `<div class="galley"><span class="stet">${esc(c.original)}</span></div>`;
  else body = galley(c.original, after, d.status === 'edited' ? 'reviewer' : 'agent');
  return `${diffbar()}
    <div class="galley-wrap">
      ${c.at < 0 ? '' : `<div class="margin-mark">
        <span class="ln">${lineRange(c)}</span>
        ${S.editing || d.status === 'rejected' ? '' : marginMarks(diff(c.original, after))}
        ${MARK[d.status] && !S.editing ? ring(MARK[d.status], S.fresh === c.id) : ''}
      </div>`}
      <div id="diffOut">${body}</div>
    </div>
    ${S.editing ? editor(after, 'Your correction (Markdown).') : ''}
    ${c.rationale ? `<section class="why"><h2>Note from the agent</h2><p>${refs(c.rationale)}</p></section>` : ''}`;
}

// The commented passage in its paragraph, as in the guide. Long context is cut at a word boundary.
function excerpt(c, d) {
  const o = S.original, end = c.at + c.original.length, cut = 360;
  // Paragraphs end at a blank line; guides converted on Windows use \r\n.
  const gap = /\n[ \t\r]*\n/g;
  let a = 0;
  for (const m of o.slice(0, c.at).matchAll(gap)) a = m.index + m[0].length;
  gap.lastIndex = end;
  const b = gap.exec(o)?.index ?? o.length;
  let before = o.slice(a, c.at), after = o.slice(end, b);
  if (before.length > cut) before = '…' + before.slice(before.indexOf(' ', before.length - cut));
  if (after.length > cut) after = after.slice(0, after.lastIndexOf(' ', cut)) + ' …';
  return `<span class="ctx">${esc(before)}</span><mark class="anchor${d.status === 'rejected' ? ' dismissed' : ''}">${esc(c.original)}</mark><sup class="cm-ref">${no(c)}</sup><span class="ctx">${esc(after)}</span>`;
}

function commentBody(c, d) {
  const sug = wording(c), ink = d.status === 'edited' ? 'reviewer' : 'agent';
  let sugBody = '';
  if (S.editing) sugBody = galley(c.original, $('#editText')?.value ?? sug ?? c.original, 'reviewer');
  else if (sug != null) sugBody = galley(c.original, sug, ink);
  const sugTitle = S.editing || d.status === 'edited' ? 'Your wording' : sug === '' ? 'Suggested: remove the passage' : 'Suggested wording';
  return `<div class="galley-wrap">
      ${c.at < 0 ? '' : `<div class="margin-mark">
        <span class="ln">${lineRange(c)}</span>
        <span class="pmark" title="Comment">${PROOF.query}</span>
        ${MARK[d.status] && !S.editing ? ring(MARK[d.status], S.fresh === c.id) : ''}
      </div>`}
      <div class="galley anchored">${c.at < 0 ? esc(c.original) : excerpt(c, d)}</div>
    </div>
    <p class="anchor-note"><mark class="anchor">Highlighted</mark> passage of the guide. A comment does not change the text.</p>
    <section class="comment${d.status === 'rejected' ? ' dismissed' : ''}">
      <h2><span class="cm-tag">${no(c)}</span>Comment by the agent</h2>
      <div class="cm-text">${refs(c.comment || '').split(/\n{2,}/).map((p) => `<p>${p}</p>`).join('')}</div>
    </section>
    ${S.editing || sug != null ? `<section class="suggest">
      <h2>${sugTitle}</h2>
      ${diffbar(false)}
      <div id="diffOut">${sugBody}</div>
      ${S.editing ? editor(sug ?? c.original, 'Wording for the Word file (Markdown). It does not change the guide here.') : ''}
    </section>` : ''}`;
}

function decideBar(c, d) {
  const com = isComment(c), off = c.at < 0 ? 'disabled' : '';
  const editLabel = com ? (wording(c) == null ? 'Write wording' : 'Edit wording') : 'Edit';
  const copyTitle = com ? 'Copy the comment, the wording, and the sources as plain text, for a comment in Word'
    : `Copy the ${d.status === 'edited' ? 'edited' : 'corrected'} text without Markdown, for pasting into Word`;
  return `<div class="decide">
      <div class="row">
        <button class="btn primary" data-act="approve" ${off}>${ICON.check}${com ? 'Accept' : 'Approve'} <kbd>A</kbd></button>
        <button class="btn" data-act="edit" ${off}>${ICON.pen}${editLabel} <kbd>E</kbd></button>
        <button class="btn reject" data-act="reject" ${off}>${ICON.x}${com ? 'Dismiss' : 'Reject'} <kbd>R</kbd></button>
        ${d.status !== 'pending' ? `<button class="btn quiet" data-act="reset">${ICON.undo}Undo <kbd>U</kbd></button>` : ''}
        ${d.status !== 'rejected' && c.at >= 0 ? `<button class="btn quiet" data-act="copy" title="${copyTitle}">${ICON.copy}<span>${com ? 'Copy comment' : 'Copy text'}</span> <kbd>C</kbd></button>` : ''}
      </div>
      <label class="note"><span class="sr-only">Note</span><input id="note" placeholder="Note for this decision (optional). Press N to write." value="${esc(d.note || '')}" ${d.status === 'pending' ? 'disabled title="Decide first, then add a note."' : ''}></label>
      ${d.at ? `<span class="decided-by">${esc(MARK[d.status])} · ${d.by ? esc(d.by) + ' · ' : ''}${new Date(d.at).toLocaleString()}</span>` : ''}
    </div>`;
}

function galley(a, b, ink) {
  const ops = diff(a, b);
  if (!S.split) return `<div class="galley">${markup(ops, ink)}</div>`;
  return `<div class="galley split"><div><h3>As published</h3>${markup(ops, ink, 'old')}</div><div><h3>${ink === 'reviewer' ? 'Your wording' : 'Proposed'}</h3>${markup(ops, ink, 'new')}</div></div>`;
}

function sourceItem(s) {
  const doi = s.doi ? `<a href="https://doi.org/${esc(s.doi)}" target="_blank" rel="noopener">doi:${esc(s.doi)}</a>` : '';
  const url = s.url && !s.url.includes(s.doi || '\u0000') ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https?:\/\//, '').slice(0, 48))}${s.url.length > 56 ? '…' : ''}</a>` : '';
  // The archived copy: a path that the agent set, or the file of the DOI in library/.
  const file = s.pdf || (s.doi && S.library.has(pdfName(s.doi)) ? 'library/' + pdfName(s.doi) : '');
  const pdf = file ? `<a class="pdf" href="${esc(encodeURI(file))}" target="_blank" rel="noopener">${ICON.doc}Open PDF</a>` : '';
  const oa = s.openalex ? `<a href="https://openalex.org/works/${esc(s.openalex)}" target="_blank" rel="noopener">OpenAlex</a>` : '';
  return `<li class="src" id="src-${esc(s.id)}">
    <div class="src-meta"><span class="id">${esc(s.id)}</span><span class="src-type">${esc(SOURCE_TYPE[s.type] || s.type)}</span>${s.year ? `<span class="num">${esc(s.year)}</span>` : ''}${s.venue ? `<span>${esc(s.venue)}</span>` : ''}${s.citedByCount != null ? `<span title="Citations in OpenAlex">Cited by <span class="num">${esc(s.citedByCount)}</span></span>` : ''}</div>
    <p class="cite">${esc(s.citation)}</p>
    ${s.verified
      ? `<p class="verify ok">${ICON.check}<span>Verified by the agent${s.verificationNote ? `. ${esc(s.verificationNote)}` : ''}</span></p>`
      : `<p class="verify no">${ICON.warn}<span><b>Not verified.</b> ${esc(s.verificationNote || 'The agent could not open this source. Check it before you approve.')}</span></p>`}
    <dl>${s.finding ? `<div><dt>Finding</dt><dd>${esc(s.finding)}</dd></div>` : ''}${s.relevance ? `<div><dt>Relevance</dt><dd>${esc(s.relevance)}</dd></div>` : ''}</dl>
    ${pdf || doi || url || oa ? `<div class="links">${pdf}${doi}${url}${oa}</div>` : ''}
  </li>`;
}

function renderSources() {
  const c = current(), el = $('#sources');
  if (!c) { el.innerHTML = ''; return; }
  const list = (c.sources || []).map((id) => S.run.sources.find((s) => s.id === id) || { id, citation: 'This source ID is not in the source list of run.json.', type: 'other', verified: false });
  el.innerHTML = `<h2><span>Sources for ${no(c)}</span><span class="num">${list.length}</span></h2>
    ${list.length ? `<ol class="srcs">${list.map(sourceItem).join('')}</ol>`
      : !isComment(c) ? '<p class="side-empty">A correction of form needs no source.</p>'
      : `<p class="no-source">No source. ${c.significance === 'incremental' ? 'The agent rates this comment incremental.' : 'Treat this comment as weak until you find a source.'}</p>`}
    <div class="keys" aria-label="Keyboard shortcuts">
      <kbd>J</kbd><span>Next change</span><kbd>K</kbd><span>Previous change</span>
      <kbd>A</kbd><span>Approve or accept</span><kbd>E</kbd><span>Edit text or wording</span><kbd>R</kbd><span>Reject or dismiss</span><kbd>U</kbd><span>Undo decision</span><kbd>C</kbd><span>Copy for Word</span>
      <kbd>S</kbd><span>Marked text or side by side</span><kbd>1 2 3</kbd><span>Changes, Assessment, Full text</span>
    </div>`;
}

function renderAssessment() {
  const r = S.run, [v, vNote] = VERDICT[r.verdict] || [r.verdict, ''];
  const src = (ids) => (ids || []).length ? `<span class="src-ref">${refs(ids.join(', '))}</span>` : '<span></span>';
  const comments = r.changes.filter(isComment), corrections = r.changes.length - comments.length;
  const counts = ['major', 'significant', 'relevant', 'incremental'].map((s) => [s, comments.filter((c) => c.significance === s).length]).filter(([, n]) => n);
  $('#assessment').innerHTML = `
    <div class="verdict"><strong>${esc(v)}</strong><small>${esc(vNote)}</small>
      <p>${esc(r.summary)}</p>
      <div class="facts"><span>Revision level: <b>${esc(LEVEL[r.revisionLevel] || r.revisionLevel)}</b></span>
        <span>Comments: <b class="num">${comments.length}</b>${counts.length ? ` (${counts.map(([s, n]) => `${n} ${s}`).join(', ')})` : ''}</span>
        <span>Corrections: <b class="num">${corrections}</b></span>
        <span>Sources: <b class="num">${r.sources.length}</b>, ${r.sources.filter((s) => !s.verified).length} not verified</span>
        <span>Run: <b>${esc(r.createdAt)}</b></span></div>
    </div>
    ${r.timeliness?.length ? `<section><h2>Timeliness by dimension</h2><table class="tl"><tbody>${r.timeliness.map((t) =>
      `<tr><th scope="row">${esc(t.dimension)}</th><td><span class="rating ${esc(t.rating)}">${esc(t.rating)}</span></td><td>${esc(t.note)}</td></tr>`).join('')}</tbody></table></section>` : ''}
    ${r.developments?.length ? `<section><h2>Most important developments, ranked</h2><ol class="devs">${r.developments.map((d) =>
      `<li><span class="dot ${esc(d.significance)}" title="${esc(d.significance)}"></span><span>${esc(d.title)} ${src(d.sources)}</span></li>`).join('')}</ol></section>` : ''}
    ${r.retain?.length ? `<section><h2>What does not need to change</h2><ul class="plain">${r.retain.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
    ${r.search ? `<section><h2>Search strategy</h2><dl class="search">
      ${r.search.databases?.length ? `<dt>Sources consulted</dt><dd>${esc(r.search.databases.join('; '))}</dd>` : ''}
      ${r.search.terms?.length ? `<dt>Search terms</dt><dd>${esc(r.search.terms.join('; '))}</dd>` : ''}
      ${r.search.dateRange ? `<dt>Date range</dt><dd>${esc(r.search.dateRange)}</dd>` : ''}
      ${r.search.inclusion ? `<dt>Inclusion</dt><dd>${esc(r.search.inclusion)}</dd>` : ''}
      ${r.search.exclusion ? `<dt>Exclusion</dt><dd>${esc(r.search.exclusion)}</dd>` : ''}
      ${r.search.limitations ? `<dt>Limitations</dt><dd>${esc(r.search.limitations)}</dd>` : ''}
    </dl></section>` : ''}
    <section><h2>All sources</h2><ol class="srcs">${r.sources.map(sourceItem).join('')}</ol></section>
    ${S.report ? `<hr class="report-rule"><section><h2>Full report (report.md)</h2><div class="prose">${md(S.report)}</div></section>` : ''}`;
}

// Full text: the guide as a Word reviewer sees it. Corrections sit in the text as proof marks.
// Comments highlight their passage and hang as balloons in the right margin.
// Private-use characters mark the places in the Markdown source; they pass the parser and then become tags.
const M = { corr: '', open: '', point: '', close: '', end: '' };
function anchorMarks(text, i) {
  return text.split('\n').map((line) => {
    if (!line.trim()) return line;
    // A table row cannot hold a highlight across cells: mark the point at its start.
    const table = line.match(/^(\s*\|\s*)/);
    if (table) return table[1] + M.point + i + M.end + line.slice(table[1].length);
    const lead = line.match(/^(\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)*)/)[1];
    const cr = line.endsWith('\r') ? '\r' : '';
    return lead + M.open + i + M.end + line.slice(lead.length, line.length - cr.length) + M.close + cr;
  }).join('\n');
}
function correctionInline(c, i) {
  const d = D(c.id);
  const inner = d.status === 'rejected' ? `<span class="stet">${esc(c.original)}</span>`
    : d.status === 'pending' ? markup(diff(c.original, c.proposed), 'agent')
    : esc(textFor(c));
  return `<span class="fx-corr ${d.status}" data-goto="${i}" title="${no(c)} correction${MARK[d.status] ? ', ' + MARK[d.status] : ''}. Open for review.">${inner}</span>`;
}
function renderFull() {
  const all = S.run.changes;
  let src = '', pos = 0;
  for (const c of all) {
    if (c.at < 0) continue;
    const i = all.indexOf(c);
    src += S.original.slice(pos, c.at) + (isComment(c) ? anchorMarks(c.original, i) : M.corr + i + M.end);
    pos = c.at + c.original.length;
  }
  src += S.original.slice(pos);
  const html = md(src)
    .replace(/(\d+)/g, (_, i) => correctionInline(all[i], i))
    .replace(/(\d+)/g, (_, i) => `<mark class="anchor${D(all[i].id).status === 'rejected' ? ' dismissed' : ''}" data-c="${i}" data-goto="${i}">`)
    .replace(/(\d+)/g, (_, i) => `<mark class="anchor point" data-c="${i}" data-goto="${i}"></mark>`)
    .replace(//g, '</mark>');
  const balloons = all.map((c, i) => [c, i]).filter(([c]) => isComment(c) && c.at >= 0).map(([c, i]) => {
    const d = D(c.id);
    return `<li class="balloon ${d.status}" data-c="${i}" data-goto="${i}" title="Open ${no(c)} for review">
      <div class="b-head"><span class="cm-tag">${no(c)}</span><span class="dot ${esc(c.significance)}" title="${esc(c.significance)}"></span>${MARK[d.status] ? `<span class="b-mark">${MARK[d.status]}</span>` : ''}</div>
      <p class="b-title">${esc(c.title)}</p>
      <p class="b-text">${esc(c.comment || '')}</p>
    </li>`;
  }).join('');
  $('#full').innerHTML = `<div class="doc"><div class="prose">${html}</div>${balloons ? `<ol class="balloons" aria-label="Comments">${balloons}</ol>` : ''}</div>`;
  // The first highlight of each comment carries its number, so text and balloon share a label.
  const seen = new Set();
  for (const m of $('#full').querySelectorAll('mark[data-c]')) {
    if (seen.has(m.dataset.c)) continue;
    seen.add(m.dataset.c);
    m.insertAdjacentHTML('afterend', `<sup class="cm-ref" data-c="${m.dataset.c}" data-goto="${m.dataset.c}">${no(all[m.dataset.c])}</sup>`);
  }
  placeBalloons();
}
// Each balloon sits level with its highlight, or under the balloon above it when two are close.
// A balloon pushed away from its highlight shows only its title, so a crowded margin stays near its text.
function placeBalloons() {
  const rail = $('#full .balloons'); if (!rail) return;
  if (getComputedStyle(rail).position !== 'relative') { for (const b of rail.children) b.style.top = ''; rail.style.height = ''; return; }
  const top0 = rail.getBoundingClientRect().top;
  let floor = 0;
  for (const b of rail.children) {
    const m = $(`#full mark[data-c="${b.dataset.c}"]`);
    const want = m ? m.getBoundingClientRect().top - top0 - 4 : floor;
    const y = Math.max(want, floor);
    b.classList.toggle('tight', y - want > 24);
    b.style.top = y + 'px';
    floor = y + b.offsetHeight + 10;
  }
  rail.style.height = floor + 'px';
}
// Pointing at a highlight lights its balloon, and the reverse.
function linkHover(e) {
  for (const h of $('#full').querySelectorAll('.hot')) h.classList.remove('hot');
  const el = e.type === 'mouseover' && e.target.closest?.('[data-c]');
  if (el) for (const h of $('#full').querySelectorAll(`[data-c="${el.dataset.c}"]`)) h.classList.add('hot');
}

function sizeNotice() {
  const n = $('#notice');
  const run = S.run;
  const parts = [];
  if (run?.synthetic) parts.push('Demo data: the guide and the run are synthetic. The sources are real publications. Each source shows whether the agent verified it.');
  if (!S.writable) parts.push(`Read-only copy: decisions stay in this browser. To save them to the repository, use <b>Export</b> and commit both files to <code>runs/${esc(run?.guide)}/${esc(run?.runId)}/</code>, or run <code>node server.mjs</code> locally.`);
  n.innerHTML = parts.join(' ');
  n.hidden = !parts.length;
  document.documentElement.style.setProperty('--notice-h', n.hidden ? '0px' : n.offsetHeight + 'px');
}

// ---------- Events ----------
function download(name, text, type) {
  const blob = text instanceof Blob ? text : new Blob([text], { type });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function bind() {
  $('#runSelect').addEventListener('change', (e) => { location.hash = e.target.value; });
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => { sizeNotice(); if (S.tab === 'changes' && S.run) placeCursor(); if (S.tab === 'full' && S.run) placeBalloons(); });
  document.fonts?.ready.then(() => { if (S.tab === 'full' && S.run) placeBalloons(); });
  $('#full').addEventListener('mouseover', linkHover);
  $('#full').addEventListener('mouseleave', linkHover);
  $('#reviewer').addEventListener('change', (e) => { S.reviewer = e.target.value.trim(); try { localStorage.setItem('guidecheck:reviewer', S.reviewer); } catch { /* ignore */ } });
  for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => vt('tab', () => { S.tab = b.dataset.tab; render(); }));
  $('#filterType').addEventListener('click', (e) => { const b = e.target.closest('[data-type]'); if (b) { S.filter.type = b.dataset.type; render(); } });
  $('#filterStatus').addEventListener('change', (e) => { S.filter.status = e.target.value; render(); });
  $('#filterSig').addEventListener('change', (e) => { S.filter.sig = e.target.value; render(); });
  $('#changeList').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) select(Number(b.dataset.i)); });
  document.addEventListener('click', (e) => { const r = e.target.closest('[data-ref]'); if (r) follow(r.dataset.ref); });
  $('#full').addEventListener('click', (e) => { const f = e.target.closest('[data-goto]'); if (f) { S.tab = 'changes'; select(Number(f.dataset.goto)); } });
  $('#exportRevised').addEventListener('click', () => download('revised.md', revised(), 'text/markdown'));
  $('#exportDecisions').addEventListener('click', () => download('decisions.json', JSON.stringify(payload(), null, 2) + '\n', 'application/json'));
  $('#exportDocx').addEventListener('click', exportDocx);
  const sheet = $('#sheet');
  sheet.addEventListener('click', (e) => {
    const sp = e.target.closest('[data-split]'); if (sp) return vt('same', () => { S.split = sp.dataset.split === '1'; renderSheet(); });
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    ({
      approve: () => decide('approved'), reject: () => decide('rejected'), reset: () => decide('pending'), copy: copyText,
      edit: startEdit, saveEdit, cancelEdit,
      prev: () => step(-1), next: () => step(1),
    })[act]?.();
  });
  sheet.addEventListener('input', (e) => {
    if (e.target.id === 'editText') $('#diffOut').innerHTML = galley(current().original, e.target.value, 'reviewer');
  });
  sheet.addEventListener('change', (e) => {
    if (e.target.id !== 'note') return;
    const c = current(); if (!S.dec[c.id]) return;
    S.dec[c.id].note = e.target.value; persist();
  });
  document.addEventListener('keydown', onKey);
}

function startEdit() { if (current()?.at >= 0) vt('same', () => { S.editing = true; S.fresh = null; renderSheet(); }); }
// The guides live in Word: copy as plain text (Markdown rendered, then tags dropped).
const plain = (t) => new DOMParser().parseFromString(md(t), 'text/html').body.textContent.replace(/\n{3,}/g, '\n\n').trim();
function copyFor(c) {
  const d = D(c.id);
  if (!isComment(c)) return plain(d.status === 'edited' ? d.text : c.proposed);
  const sug = wording(c), cites = (c.sources || []).map((id) => S.run.sources.find((s) => s.id === id)?.citation).filter(Boolean);
  return [plain(c.comment || ''), sug ? `Suggested wording:\n${plain(sug)}` : sug === '' ? 'Suggested: remove the passage.' : '', cites.length ? `Sources:\n${cites.join('\n')}` : '']
    .filter(Boolean).join('\n\n');
}
// Word file for review: approved corrections applied, accepted comments as Word comments on their passages.
async function exportDocx() {
  const btn = $('#exportDocx'), label = btn.firstChild, idle = label.textContent;
  const all = S.run.changes, comments = [];
  let src = '', pos = 0;
  for (const c of all) {
    if (c.at < 0) continue;
    const d = D(c.id);
    src += S.original.slice(pos, c.at);
    if (isComment(c) && (d.status === 'approved' || d.status === 'edited')) {
      const id = comments.length;
      comments.push({
        id, author: `Guidecheck · ${S.run.agent}`, initials: 'GC', date: d.at.replace(/\.\d+Z$/, 'Z'),
        paragraphs: [{ text: `${no(c)} · ${c.title}`, bold: true }, ...copyFor(c).split(/\n+/).map((text) => ({ text })),
          ...(d.note ? [{ text: `Note${d.by ? ` from ${d.by}` : ''}: ${d.note}` }] : [])],
      });
      src += DOCX.wrap(c.original, id);
    } else src += textFor(c);
    pos = c.at + c.original.length;
  }
  src += S.original.slice(pos);
  label.textContent = 'Building…';
  try {
    const title = S.runs.find((r) => r.guide === S.run.guide)?.guideTitle || S.run.guide;
    const { blob } = await DOCX.build({ markdown: src, comments, base: `runs/${S.run.guide}/${S.run.runId}/`, title });
    download(`${S.run.guide}-${S.run.runId}-review.docx`, blob);
    label.textContent = idle;
  } catch (e) {
    label.textContent = `Not built: ${e.message}`;
    setTimeout(() => { label.textContent = idle; }, 4000);
  }
}
async function copyText() {
  const c = current(), label = $('[data-act="copy"] span');
  if (!label) return;
  const idle = label.textContent;
  try { await navigator.clipboard.writeText(copyFor(c)); label.textContent = 'Copied'; }
  catch { label.textContent = 'Copy failed: select the text by hand'; }
  setTimeout(() => { if (label.isConnected) label.textContent = idle; }, 1600);
}
function cancelEdit() { vt('same', () => { S.editing = false; renderSheet(); }); }
function saveEdit() {
  const c = current(), text = $('#editText').value;
  if (text === (isComment(c) ? c.suggestion : c.proposed)) decide('approved'); else decide('edited', { text });
}

function onKey(e) {
  if (e.target.id === 'editText') {
    if (e.key === 'Escape') cancelEdit();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit(); }
    return;
  }
  if (e.target.matches?.('input, select, textarea')) { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey || !S.run) return;
  const k = e.key.toLowerCase();
  if (k === '1' || k === '2' || k === '3') return vt('tab', () => { S.tab = ['changes', 'assessment', 'full'][Number(k) - 1]; render(); });
  if (S.tab !== 'changes') return;
  const map = {
    j: () => step(1), arrowdown: () => step(1), k: () => step(-1), arrowup: () => step(-1),
    a: () => decide('approved'), r: () => decide('rejected'), u: () => decide('pending'), e: startEdit, c: copyText,
    s: () => vt('same', () => { S.split = !S.split; renderSheet(); }), n: () => { const n = $('#note'); if (n && !n.disabled) { e.preventDefault(); n.focus(); } },
  };
  if (map[k]) { if (k !== 'n') e.preventDefault(); map[k](); }
}

init();
