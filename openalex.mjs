#!/usr/bin/env node
// OpenAlex lookups and the PDF source archive. Node standard library only (Node 18+ for fetch).
//   node openalex.mjs work <doi|W-id>              metadata of one work, for a source entry
//   node openalex.mjs citing <guide> [--limit N]   works that cite the guide, after its date, most cited first
//   node openalex.mjs search <guide> "<terms>" [--limit N]   works on the terms, after the guide date
//   node openalex.mjs fetch <doi>                  download the open access PDF into library/
//   node openalex.mjs add <file.pdf> <doi>         copy a PDF that you downloaded into library/
//   node openalex.mjs sync runs/<guide>/<runId>    rewrite the scholarly sources of run.json from OpenAlex
// Add --json for the full result. Set OPENALEX_API_KEY or OPENALEX_MAILTO to use your own quota.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const LIBRARY = join(ROOT, 'library');
const API = 'https://api.openalex.org';
const SELECT = 'id,doi,display_name,publication_year,publication_date,authorships,primary_location,type,biblio,cited_by_count,is_retracted,best_oa_location';
// Same rule as app.js: the archive file name of a DOI.
const pdfName = (doi) => doi.toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/[^a-z0-9.-]+/g, '_') + '.pdf';

async function api(path, params = {}) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (process.env.OPENALEX_API_KEY) url.searchParams.set('api_key', process.env.OPENALEX_API_KEY);
  if (process.env.OPENALEX_MAILTO) url.searchParams.set('mailto', process.env.OPENALEX_MAILTO);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenAlex ${res.status} for ${path}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const workPath = (id) => `/works/${/^W\d+$/i.test(id) ? id : 'doi:' + id.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}`;
const title = (w) => String(w.display_name || '').replace(/<[^>]+>/g, '').trim();

// APA 7 citation from OpenAlex metadata, so that every scholarly source has the same form.
// OpenAlex has no structured names: "Wim van Oorschot" becomes "van Oorschot, W.". The DOI is in its own field.
const PARTICLE = /^(van|von|de|der|den|del|da|di|du|la|le|dos|das|ten|ter)$/i;
function apaName(full) {
  const p = full.trim().split(/\s+/);
  let i = p.length - 1;
  while (i > 1 && PARTICLE.test(p[i - 1])) i--;
  const given = p.slice(0, i).map((g) => g.split('-').map((x) => x[0].toUpperCase() + '.').join('-'));
  return given.length ? `${p.slice(i).join(' ')}, ${given.join(' ')}` : p.join(' ');
}
function apa(w) {
  const names = (w.authorships || []).map((a) => apaName(a.author.display_name));
  const who = names.length > 20 ? `${names.slice(0, 19).join(', ')}, … ${names.at(-1)}`
    : names.length > 1 ? `${names.slice(0, -1).join(', ')}, & ${names.at(-1)}` : names[0];
  const t = title(w), dot = /[?!.]$/.test(t) ? '' : '.';
  const head = who ? `${who} (${w.publication_year}). ${t}${dot}` : `${t}${dot} (${w.publication_year}).`;
  const src = w.primary_location?.source, bib = w.biblio || {};
  const pages = bib.first_page && bib.last_page && bib.last_page !== bib.first_page ? `${bib.first_page}–${bib.last_page}` : bib.first_page || '';
  const publisher = src?.host_organization_name || '';
  if (w.type === 'book') return `${head} ${publisher || src?.display_name || ''}`.trim().replace(/([^.])$/, '$1.');
  if (w.type === 'book-chapter') return `${head}${src ? ` In ${src.display_name}${pages ? ` (pp. ${pages})` : ''}.` : ''}${publisher ? ` ${publisher}.` : ''}`;
  const vol = bib.volume ? `, ${bib.volume}${bib.issue ? `(${bib.issue})` : ''}` : '';
  return src ? `${head} ${src.display_name}${vol}${pages ? `, ${pages}` : ''}.` : head;
}

// The fields that a source entry in run.json needs.
const brief = (w) => ({
  openalex: w.id.replace('https://openalex.org/', ''),
  doi: w.doi?.replace('https://doi.org/', '') || undefined,
  citation: apa(w),
  title: title(w),
  authors: (w.authorships || []).map((a) => a.author.display_name),
  year: w.publication_year,
  date: w.publication_date,
  venue: w.primary_location?.source?.display_name || undefined,
  openalexType: w.type,
  citedByCount: w.cited_by_count,
  retracted: w.is_retracted || undefined,
  oaPdf: w.best_oa_location?.pdf_url || undefined,
});

// The citation of a source: APA 7 from the DOI registry (Crossref or DataCite, formatted with the CSL APA style,
// as in Zotero). The registry has structured names and the book of a chapter. Without a DOI, or if the registry
// fails, the citation built from the OpenAlex record stays.
async function cite(w) {
  const b = brief(w);
  if (b.doi) {
    const text = await fetch(`https://doi.org/${b.doi}`, { headers: { accept: 'text/x-bibliography; style=apa; locale=en-US' } })
      .then((r) => (r.ok ? r.text() : '')).catch(() => '');
    if (/^[^<]+\(\d{4}/.test(text.trim())) b.citation = text.trim();
  }
  b.year = Number(b.citation.match(/\((\d{4})/)?.[1]) || b.year;
  return b;
}

const line = (b) => `${b.openalex}  ${b.year}  cited ${b.citedByCount}${b.retracted ? '  RETRACTED' : ''}${b.oaPdf ? '  [OA PDF]' : ''}\n    ${b.title}\n    ${b.authors.slice(0, 3).join(', ')}${b.authors.length > 3 ? ' et al.' : ''}${b.venue ? ` · ${b.venue}` : ''}${b.doi ? ` · doi:${b.doi}` : ''}`;

async function guideMeta(guide) {
  try { return JSON.parse(await readFile(join(ROOT, 'guides', guide, 'guide.json'), 'utf8')); } catch { throw new Error(`guides/${guide}/guide.json is missing`); }
}

async function list(params, json) {
  const r = await api('/works', { select: SELECT, ...params });
  const items = r.results.map(brief);
  console.log(json ? JSON.stringify({ count: r.meta.count, results: items }, null, 2) : `${r.meta.count} work(s), showing ${items.length}\n\n${items.map(line).join('\n\n')}`);
}

async function savePdf(doi, bytes) {
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('The file is not a PDF.');
  await mkdir(LIBRARY, { recursive: true });
  await writeFile(join(LIBRARY, pdfName(doi)), bytes);
  console.log(`Saved library/${pdfName(doi)}. Run "node server.mjs --index" to show it in the interface.`);
}

const USAGE = 'Usage:\n  node openalex.mjs work <doi|W-id>\n  node openalex.mjs citing <guide> [--limit N]\n  node openalex.mjs search <guide> "<terms>" [--limit N]\n  node openalex.mjs fetch <doi>\n  node openalex.mjs add <file.pdf> <doi>\n  node openalex.mjs sync runs/<guide>/<runId>\nAdd --json for the full result.';
const args = process.argv.slice(2);
const json = args.includes('--json');
const limitAt = args.indexOf('--limit');
const limit = limitAt >= 0 ? args[limitAt + 1] : '25';
const [cmd, a, b] = args.filter((x, i) => !x.startsWith('--') && (limitAt < 0 || i !== limitAt + 1));

try {
  if (cmd === 'work' && a) {
    const w = await cite(await api(workPath(a), { select: SELECT }));
    console.log(json ? JSON.stringify(w, null, 2) : line(w));
  } else if (cmd === 'citing' && a) {
    const g = await guideMeta(a);
    if (!g.doi) throw new Error(`guides/${a}/guide.json has no DOI. Use "search" instead.`);
    const w = await api(workPath(g.doi), { select: 'id' });
    await list({ filter: `cites:${w.id.replace('https://openalex.org/', '')},from_publication_date:${g.date}`, sort: 'cited_by_count:desc', 'per-page': limit }, json);
  } else if (cmd === 'search' && a && b) {
    const g = await guideMeta(a);
    await list({ search: b, filter: `from_publication_date:${g.date}`, 'per-page': limit }, json);
  } else if (cmd === 'fetch' && a) {
    const w = await api(workPath(a), { select: 'doi,best_oa_location,locations' });
    const doi = w.doi?.replace('https://doi.org/', '') || a;
    const urls = [...new Set([w.best_oa_location?.pdf_url, ...(w.locations || []).map((l) => l.pdf_url)].filter(Boolean))];
    // Many repositories send a web page instead of the PDF. Try each location until one sends a PDF.
    for (const u of urls) {
      const bytes = await fetch(u, { headers: { 'user-agent': 'Guidecheck (https://github.com/Eyecatch3r/guidecheck)' } })
        .then(async (r) => (r.ok ? Buffer.from(await r.arrayBuffer()) : null)).catch(() => null);
      if (bytes?.subarray(0, 5).toString() === '%PDF-') { await savePdf(doi, bytes); break; }
      console.error(`No PDF at ${u}`);
    }
    if (!existsSync(join(LIBRARY, pdfName(doi)))) throw new Error(`No open access PDF found. Download it yourself, then use: node openalex.mjs add <file.pdf> ${doi}`);
  } else if (cmd === 'add' && a && b) {
    await savePdf(b, await readFile(a));
  } else if (cmd === 'sync' && a) {
    // Replace the metadata of each source that has a DOI or OpenAlex ID with the OpenAlex record.
    // A source without either (a web page, a standard, a law) stays as the agent wrote it.
    const file = join(resolve(a), 'run.json');
    const run = JSON.parse(await readFile(file, 'utf8'));
    const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
    let n = 0, problems = 0;
    for (const s of run.sources || []) {
      if (!s.doi && !s.openalex) {
        if (['peer-reviewed', 'preprint', 'book'].includes(s.type)) { problems++; console.log(`${s.id}: ${s.type} source without DOI. Find it with "search" or "work".`); }
        continue;
      }
      const w = await api(workPath(s.openalex || s.doi), { select: SELECT }).catch(() => null);
      if (!w) { problems++; console.log(`${s.id}: not in OpenAlex (${s.openalex || s.doi}). Check the DOI. Not changed.`); continue; }
      const b = await cite(w);
      // A wrong DOI must not swap in another work: the old citation must contain the OpenAlex title.
      if (s.citation && !norm(s.citation).includes(norm(b.title).slice(0, 40))) {
        problems++; console.log(`${s.id}: ${s.openalex || s.doi} is "${b.title}", not the cited work. Check the DOI. Not changed.`); continue;
      }
      if (b.retracted) { problems++; console.log(`${s.id}: RETRACTED in OpenAlex. Do not use it as evidence.`); }
      Object.assign(s, { citation: b.citation, openalex: b.openalex, citedByCount: b.citedByCount },
        b.doi && { doi: b.doi }, b.year && { year: b.year }, b.venue && { venue: b.venue });
      n++;
    }
    await writeFile(file, JSON.stringify(run, null, 2) + '\n');
    console.log(`${n} of ${(run.sources || []).length} source(s) use OpenAlex metadata. ${problems} problem(s).`);
    if (problems) process.exitCode = 1;
  } else {
    console.log(USAGE);
    process.exitCode = 1;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
