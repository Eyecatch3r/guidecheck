// Guidecheck review interface. No build step, no dependencies except marked (Markdown).
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fetchText = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.text() : null)).catch(() => null);
const fetchJSON = async (u) => { const t = await fetchText(u); try { return t ? JSON.parse(t) : null; } catch { return null; } };

const ICON = {
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>',
  x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  pen: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 2.5l3 3L6 13l-3.5.5L3 10z"/></svg>',
  undo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 3L2.5 6l3 3"/><path d="M2.5 6H10a3.5 3.5 0 010 7H7"/></svg>',
  warn: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2l6.5 11.5h-13z"/><path d="M8 6.5v3M8 11.6v.1"/></svg>',
  up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10l4-4 4 4"/></svg>',
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

const S = {
  runs: [], writable: false, run: null, original: '', report: '', dec: {},
  i: 0, tab: 'changes', split: false, editing: false, fresh: null,
  filter: { status: 'all', sig: 'all' }, reviewer: '',
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
const textFor = (c) => { const d = D(c.id); return d.status === 'approved' ? c.proposed : d.status === 'edited' ? d.text : c.original; };

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
  document.startViewTransition(update).finished.finally(() => { if (root.dataset.vt === kind) delete root.dataset.vt; });
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
  run.changes.forEach((c) => { c.at = original.indexOf(c.original); });
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
  const v = visible();
  $('#changeList').innerHTML = v.length ? v.map(({ c, i }) => {
    const st = D(c.id).status;
    const weak = c.significance !== 'incremental' && !c.sources?.length;
    return `<li><button data-i="${i}" aria-current="${i === S.i}">
      <span class="no">${no(c)}</span>
      <span class="dot ${esc(c.significance)}" title="${esc(c.significance)}"></span>
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
  const d = D(c.id), k = S.run.changes.indexOf(c) + 1;
  const after = d.status === 'edited' ? d.text : c.proposed;
  const ink = d.status === 'edited' ? 'reviewer' : 'agent';
  let body;
  if (S.editing) body = galley(c.original, $('#editText')?.value ?? after, 'reviewer');
  else if (d.status === 'rejected') body = `<div class="galley"><span class="stet">${esc(c.original)}</span></div>`;
  else body = galley(c.original, after, ink);

  el.innerHTML = `
    <span class="slug-no">${no(c)}</span>
    <div class="slug">
      <span class="sig"><span class="dot ${esc(c.significance)}"></span>${esc(c.significance)}</span><span class="sep"></span>
      <span class="cap">${esc(c.direction)}</span><span class="sep"></span>
      <span class="cap">${esc(c.priority)}</span>
      ${c.kind ? `<span class="sep"></span><span class="cap">${esc(c.kind)}</span>` : ''}
      <span class="pos"><button class="btn quiet" data-act="prev" aria-label="Previous change (K)" title="Previous change (K)">${ICON.up}</button><span class="num">${k} / ${S.run.changes.length}</span><button class="btn quiet" data-act="next" aria-label="Next change (J)" title="Next change (J)">${ICON.down}</button></span>
    </div>
    <h1 class="change-title">${esc(c.title)}</h1>
    <p class="change-sec">${esc(c.section)}</p>
    ${c.at < 0 ? `<p class="anchor-error">The original text of this change is not in <code>original.md</code>. The change cannot be applied. Ask the agent to correct it, then run <code>node server.mjs --check</code>.</p>` : ''}
    <div class="diffbar">
      <div class="seg" role="group" aria-label="Diff layout">
        <button data-split="0" aria-pressed="${!S.split}">Marked text</button><button data-split="1" aria-pressed="${S.split}">Side by side</button>
      </div>
      <div class="legend"><span><del class="pm-del ink-agent">struck</del> removed</span><span><ins class="pm-ins ink-agent">blue</ins> added by agent</span><span><ins class="pm-ins ink-reviewer">red</ins> your edit</span></div>
    </div>
    <div class="galley-wrap" style="position:relative">
      ${c.at < 0 ? '' : `<div class="margin-mark">
        <span class="ln">${lineRange(c)}</span>
        ${S.editing || d.status === 'rejected' ? '' : marginMarks(diff(c.original, after))}
        ${MARK[d.status] && !S.editing ? ring(MARK[d.status], S.fresh === c.id) : ''}
      </div>`}
      <div id="diffOut">${body}</div>
    </div>
    ${S.editing ? `<div class="editor">
      <label for="editText">Your wording (Markdown). The marks above update as you type.</label>
      <textarea id="editText" spellcheck="true">${esc(after)}</textarea>
      <div class="row"><button class="btn primary" data-act="saveEdit">${ICON.check}Save edit <kbd>Ctrl+Enter</kbd></button><button class="btn quiet" data-act="cancelEdit">Cancel <kbd>Esc</kbd></button></div>
    </div>` : ''}
    <section class="why"><h2>Why the agent proposes this</h2><p>${esc(c.rationale)}</p></section>
    ${S.editing ? '' : `<div class="decide">
      <div class="row">
        <button class="btn primary" data-act="approve" ${c.at < 0 ? 'disabled' : ''}>${ICON.check}Approve <kbd>A</kbd></button>
        <button class="btn" data-act="edit" ${c.at < 0 ? 'disabled' : ''}>${ICON.pen}Edit <kbd>E</kbd></button>
        <button class="btn reject" data-act="reject" ${c.at < 0 ? 'disabled' : ''}>${ICON.x}Reject <kbd>R</kbd></button>
        ${d.status !== 'pending' ? `<button class="btn quiet" data-act="reset">${ICON.undo}Undo <kbd>U</kbd></button>` : ''}
      </div>
      <label class="note"><span class="sr-only">Note</span><input id="note" placeholder="Note for this decision (optional). Press N to write." value="${esc(d.note || '')}" ${d.status === 'pending' ? 'disabled title="Decide first, then add a note."' : ''}></label>
      ${d.at ? `<span class="decided-by">${esc(MARK[d.status])} · ${d.by ? esc(d.by) + ' · ' : ''}${new Date(d.at).toLocaleString()}</span>` : ''}
    </div>`}`;
  if (S.editing) { const t = $('#editText'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
}

function galley(a, b, ink) {
  const ops = diff(a, b);
  if (!S.split) return `<div class="galley">${markup(ops, ink)}</div>`;
  return `<div class="galley split"><div><h3>As published</h3>${markup(ops, ink, 'old')}</div><div><h3>${ink === 'reviewer' ? 'Your wording' : 'Proposed'}</h3>${markup(ops, ink, 'new')}</div></div>`;
}

function sourceItem(s) {
  const doi = s.doi ? `<a href="https://doi.org/${esc(s.doi)}" target="_blank" rel="noopener">doi:${esc(s.doi)}</a>` : '';
  const url = s.url && !s.url.includes(s.doi || '\u0000') ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url.replace(/^https?:\/\//, '').slice(0, 48))}${s.url.length > 56 ? '…' : ''}</a>` : '';
  return `<li class="src" id="src-${esc(s.id)}">
    <div class="src-meta"><span class="id">${esc(s.id)}</span><span class="src-type">${esc(SOURCE_TYPE[s.type] || s.type)}</span>${s.year ? `<span class="num">${esc(s.year)}</span>` : ''}${s.venue ? `<span>${esc(s.venue)}</span>` : ''}</div>
    <p class="cite">${esc(s.citation)}</p>
    ${s.verified
      ? `<p class="verify ok">${ICON.check}<span>Verified by the agent${s.verificationNote ? `. ${esc(s.verificationNote)}` : ''}</span></p>`
      : `<p class="verify no">${ICON.warn}<span><b>Not verified.</b> ${esc(s.verificationNote || 'The agent could not open this source. Check it before you approve.')}</span></p>`}
    <dl>${s.finding ? `<div><dt>Finding</dt><dd>${esc(s.finding)}</dd></div>` : ''}${s.relevance ? `<div><dt>Relevance</dt><dd>${esc(s.relevance)}</dd></div>` : ''}</dl>
    ${doi || url ? `<div class="links">${doi}${url}</div>` : ''}
  </li>`;
}

function renderSources() {
  const c = current(), el = $('#sources');
  if (!c) { el.innerHTML = ''; return; }
  const list = (c.sources || []).map((id) => S.run.sources.find((s) => s.id === id) || { id, citation: 'This source ID is not in the source list of run.json.', type: 'other', verified: false });
  el.innerHTML = `<h2><span>Sources for ${no(c)}</span><span class="num">${list.length}</span></h2>
    ${list.length ? `<ol class="srcs">${list.map(sourceItem).join('')}</ol>`
      : `<p class="no-source">No source. ${c.significance === 'incremental' ? 'The agent rates this change incremental.' : 'Treat this change as weak until you find a source.'}</p>`}
    <div class="keys" aria-label="Keyboard shortcuts">
      <kbd>J</kbd><span>Next change</span><kbd>K</kbd><span>Previous change</span>
      <kbd>A</kbd><span>Approve</span><kbd>E</kbd><span>Edit</span><kbd>R</kbd><span>Reject</span><kbd>U</kbd><span>Undo decision</span>
      <kbd>S</kbd><span>Marked text or side by side</span><kbd>1 2 3</kbd><span>Changes, Assessment, Full text</span>
    </div>`;
}

function renderAssessment() {
  const r = S.run, [v, vNote] = VERDICT[r.verdict] || [r.verdict, ''];
  const src = (ids) => (ids || []).length ? `<span class="src-ref">${ids.map(esc).join(', ')}</span>` : '<span></span>';
  const counts = ['major', 'significant', 'relevant', 'incremental'].map((s) => [s, r.changes.filter((c) => c.significance === s).length]).filter(([, n]) => n);
  $('#assessment').innerHTML = `
    <div class="verdict"><strong>${esc(v)}</strong><small>${esc(vNote)}</small>
      <p>${esc(r.summary)}</p>
      <div class="facts"><span>Revision level: <b>${esc(LEVEL[r.revisionLevel] || r.revisionLevel)}</b></span>
        <span>Changes: <b class="num">${r.changes.length}</b> (${counts.map(([s, n]) => `${n} ${s}`).join(', ')})</span>
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

function renderFull() {
  let html = '', pos = 0;
  for (const c of S.run.changes) {
    if (c.at < 0) continue;
    html += md(S.original.slice(pos, c.at));
    const d = D(c.id), i = S.run.changes.indexOf(c);
    const inner = d.status === 'approved' || d.status === 'edited' ? `<div class="prose-in">${md(textFor(c))}</div>`
      : d.status === 'rejected' ? `<div class="galley"><span class="stet">${esc(c.original)}</span></div>`
      : `<div class="galley">${markup(diff(c.original, c.proposed), 'agent')}</div>`;
    html += `<div class="fx" data-goto="${i}" title="Open ${no(c)} for review">
      <div class="margin-mark"><span class="fx-no">${no(c)}</span><span class="ln">${lineRange(c)}</span>${MARK[d.status] ? ring(MARK[d.status]) : ''}</div>${inner}</div>`;
    pos = c.at + c.original.length;
  }
  html += md(S.original.slice(pos));
  $('#full').innerHTML = `<div class="prose">${html}</div>`;
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
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function bind() {
  $('#runSelect').addEventListener('change', (e) => { location.hash = e.target.value; });
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => { sizeNotice(); if (S.tab === 'changes' && S.run) placeCursor(); });
  $('#reviewer').addEventListener('change', (e) => { S.reviewer = e.target.value.trim(); try { localStorage.setItem('guidecheck:reviewer', S.reviewer); } catch { /* ignore */ } });
  for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => vt('tab', () => { S.tab = b.dataset.tab; render(); }));
  $('#filterStatus').addEventListener('change', (e) => { S.filter.status = e.target.value; render(); });
  $('#filterSig').addEventListener('change', (e) => { S.filter.sig = e.target.value; render(); });
  $('#changeList').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) select(Number(b.dataset.i)); });
  $('#full').addEventListener('click', (e) => { const f = e.target.closest('[data-goto]'); if (f) { S.tab = 'changes'; select(Number(f.dataset.goto)); } });
  $('#exportRevised').addEventListener('click', () => download('revised.md', revised(), 'text/markdown'));
  $('#exportDecisions').addEventListener('click', () => download('decisions.json', JSON.stringify(payload(), null, 2) + '\n', 'application/json'));
  const sheet = $('#sheet');
  sheet.addEventListener('click', (e) => {
    const sp = e.target.closest('[data-split]'); if (sp) return vt('same', () => { S.split = sp.dataset.split === '1'; renderSheet(); });
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    ({
      approve: () => decide('approved'), reject: () => decide('rejected'), reset: () => decide('pending'),
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
function cancelEdit() { vt('same', () => { S.editing = false; renderSheet(); }); }
function saveEdit() {
  const c = current(), text = $('#editText').value;
  if (text === c.proposed) decide('approved'); else decide('edited', { text });
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
    a: () => decide('approved'), r: () => decide('rejected'), u: () => decide('pending'), e: startEdit,
    s: () => vt('same', () => { S.split = !S.split; renderSheet(); }), n: () => { const n = $('#note'); if (n && !n.disabled) { e.preventDefault(); n.focus(); } },
  };
  if (map[k]) { if (k !== 'n') e.preventDefault(); map[k](); }
}

init();
