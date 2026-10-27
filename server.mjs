#!/usr/bin/env node
// Guidecheck local server. Node standard library only.
//   node server.mjs            serve the review interface on http://localhost:4173 (read-write)
//   node server.mjs --index    rebuild runs/index.json
//   node server.mjs --check    validate every run (or: --check runs/<guide>/<runId>)
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const RUNS = join(ROOT, 'runs');
const PORT = Number(process.env.PORT) || 4173;
const SLUG = /^[a-z0-9][a-z0-9.-]*$/;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
};

const readJSON = async (p, fallback) => {
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; }
};
const dirs = async (p) => {
  try { return (await readdir(p, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort(); } catch { return []; }
};

export async function buildIndex() {
  const runs = [];
  for (const guide of await dirs(RUNS)) {
    const meta = await readJSON(join(ROOT, 'guides', guide, 'guide.json'), {});
    for (const runId of await dirs(join(RUNS, guide))) {
      const run = await readJSON(join(RUNS, guide, runId, 'run.json'), null);
      if (!run) continue;
      const dec = await readJSON(join(RUNS, guide, runId, 'decisions.json'), { decisions: {} });
      const decided = Object.values(dec.decisions || {}).filter((d) => d.status && d.status !== 'pending').length;
      runs.push({
        guide, runId, guideTitle: meta.title || guide, createdAt: run.createdAt, agent: run.agent,
        verdict: run.verdict, changes: run.changes.length, decided, synthetic: !!run.synthetic,
      });
    }
  }
  runs.sort((a, b) => a.guideTitle.localeCompare(b.guideTitle) || b.runId.localeCompare(a.runId));
  await writeFile(join(RUNS, 'index.json'), JSON.stringify({ runs }, null, 2) + '\n');
  return runs;
}

// Returns a list of problems for one run folder. Empty list = valid.
export async function checkRun(dir) {
  const problems = [];
  const run = await readJSON(join(dir, 'run.json'), null);
  if (!run) return ['run.json is missing or is not valid JSON'];
  let original;
  try { original = await readFile(join(dir, 'original.md'), 'utf8'); } catch { return ['original.md is missing']; }
  if (!existsSync(join(dir, 'report.md'))) problems.push('report.md is missing');
  const sourceIds = new Set((run.sources || []).map((s) => s.id));
  const spans = [];
  for (const c of run.changes || []) {
    const at = original.indexOf(c.original);
    if (!c.original || at < 0) { problems.push(`${c.id}: "original" text is not in original.md`); continue; }
    if (original.indexOf(c.original, at + 1) >= 0) problems.push(`${c.id}: "original" text occurs more than one time`);
    spans.push([at, at + c.original.length, c.id]);
    for (const s of c.sources || []) if (!sourceIds.has(s)) problems.push(`${c.id}: source "${s}" is not in sources`);
    // Version 1 runs have no type: every change is a comment.
    const type = c.type || (run.schemaVersion >= 2 ? '' : 'comment');
    if (type === 'correction') {
      if (typeof c.proposed !== 'string') problems.push(`${c.id}: a correction needs "proposed"`);
      continue;
    }
    if (type !== 'comment') { problems.push(`${c.id}: "type" must be "comment" or "correction"`); continue; }
    if (!(c.comment || c.rationale)) problems.push(`${c.id}: a comment needs "comment" text`);
    if (c.significance !== 'incremental' && !(c.sources || []).length) problems.push(`${c.id}: no source for a ${c.significance} comment`);
  }
  spans.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < spans.length; i++) if (spans[i][0] < spans[i - 1][1]) problems.push(`${spans[i - 1][2]} and ${spans[i][2]} overlap`);
  const ids = (run.changes || []).map((c) => c.id);
  if (new Set(ids).size !== ids.length) problems.push('two changes have the same id');
  return problems;
}

async function check(targets) {
  if (!targets.length) for (const g of await dirs(RUNS)) for (const r of await dirs(join(RUNS, g))) targets.push(join(RUNS, g, r));
  let failed = 0;
  for (const t of targets) {
    const problems = await checkRun(resolve(t));
    if (problems.length) failed++;
    console.log(`${problems.length ? 'FAIL' : 'OK  '} ${t}`);
    for (const p of problems) console.log(`     - ${p}`);
  }
  process.exitCode = failed ? 1 : 0;
}

async function save(req, res) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 5e6) return send(res, 413, { error: 'Request is too large' }); }
  let data;
  try { data = JSON.parse(body); } catch { return send(res, 400, { error: 'Body is not valid JSON' }); }
  const { guide, runId, decisions, revised } = data;
  if (!SLUG.test(guide || '') || !SLUG.test(runId || '')) return send(res, 400, { error: 'Guide or run name is not valid' });
  const dir = join(RUNS, guide, runId);
  if (!existsSync(join(dir, 'run.json'))) return send(res, 404, { error: 'Run does not exist' });
  await writeFile(join(dir, 'decisions.json'), JSON.stringify(decisions, null, 2) + '\n');
  if (typeof revised === 'string') await writeFile(join(dir, 'revised.md'), revised);
  await buildIndex();
  send(res, 200, { ok: true, savedAt: new Date().toISOString() });
}

function send(res, code, obj) {
  res.writeHead(code, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

async function serve(req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/status') return send(res, 200, { writable: true });
  if (url.pathname === '/api/save' && req.method === 'POST') return save(req, res);
  const path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!path.startsWith(ROOT + sep) && path !== ROOT) return send(res, 403, { error: 'Forbidden' });
  try {
    const file = (await stat(path)).isDirectory() ? join(path, 'index.html') : path;
    const content = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(content);
  } catch {
    send(res, 404, { error: 'Not found' });
  }
}

const args = process.argv.slice(2);
if (args[0] === '--index') {
  console.log(`runs/index.json: ${(await buildIndex()).length} run(s)`);
} else if (args[0] === '--check') {
  await check(args.slice(1));
} else {
  await buildIndex();
  // Bind to the loopback interface only: the save endpoint writes files.
  createServer((req, res) => serve(req, res).catch((e) => send(res, 500, { error: String(e.message || e) })))
    .listen(PORT, '127.0.0.1', () => console.log(`Guidecheck: http://localhost:${PORT}`));
}
