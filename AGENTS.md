# Agent instructions

These instructions are for AI coding agents (Claude Code, Codex, and similar) that work in this repository. Humans can read `README.md` instead.

Your job is to find stale, deprecated, or superseded content in a guide and to propose sourced changes. A human reviews every change in the web interface. You never change a published guide without a human decision.

## Folder structure

```
guides/<guide>/source.pdf      original PDF (optional, do not commit if the license does not permit it)
guides/<guide>/guide.md        current text of the guide, in Markdown
guides/<guide>/guide.json      metadata: title, authors, publisher, date, doi, field, topic
guides/<guide>/prompt.md       optional copy of the base prompt, adapted for this guide
prompts/update-assessment.md   base prompt for every run
schema/run.schema.json         format of run.json
runs/<guide>/<runId>/          one folder per run (see below)
runs/index.json                list of all runs, made by `node server.mjs --index`
openalex.mjs                   OpenAlex search and the PDF archive (see "OpenAlex workflow")
library/<doi>.pdf              archived source PDFs, not in Git
```

A run folder contains these files:

| File | Written by | Content |
|---|---|---|
| `original.md` | agent | Copy of `guides/<guide>/guide.md` at the start of the run |
| `report.md` | agent | Full assessment, parts 1 to 8 of the prompt |
| `run.json` | agent | Structured result: verdict, changes, sources |
| `decisions.json` | interface | Approve, reject, or edit decision for each change |
| `revised.md` | interface | `original.md` with the approved and edited corrections applied. Comments do not change the text. |

Use lowercase letters, digits, and hyphens for `<guide>`. Use `YYYY-MM-DD-<agent>` for `<runId>`, for example `2026-10-21-claude`.

## Task 1: Add a guide from a PDF

Do these steps when the user asks you to add or convert a guide.

1. Make the folder `guides/<guide>/`.
2. If the PDF is not in the folder, copy it to `guides/<guide>/source.pdf`.
3. Convert the PDF to Markdown. Use one of these tools:
   - Read the PDF directly, if your tool can read PDF files.
   - `markitdown source.pdf > guide.md` (Python package `markitdown`).
   - `pdftotext -layout source.pdf -` (Poppler), then clean the text.
4. Clean the Markdown:
   - Remove running headers, page numbers, and footers.
   - Join words that the PDF split with a hyphen at a line end.
   - Join lines into full paragraphs. Keep one blank line between paragraphs.
   - Write headings as `#`, `##`, and `###`. Keep the numbering of the PDF.
   - Write lists as Markdown lists and tables as Markdown tables.
   - Keep the reference list at the end of the guide.
5. Make sure that the text is complete. Compare the first and last sentence of each section with the PDF.
6. Write `guides/<guide>/guide.json`:

   ```json
   {
     "title": "Title of the guide",
     "authors": "Family, G., & Family, G.",
     "publisher": "Publisher or series",
     "date": "2016-03-01",
     "doi": "10.xxxx/xxxxx",
     "field": "Survey methodology",
     "topic": "One sentence on the research question or scope"
   }
   ```

7. Tell the user what you could not convert (for example, figures or formulas).

## Task 2: Run an update check

Do these steps when the user asks you to check, update, or assess a guide.

1. Read `guides/<guide>/guide.json` and `guides/<guide>/guide.md`.
2. Make the run folder `runs/<guide>/<runId>/`.
3. Copy `guides/<guide>/guide.md` to `runs/<guide>/<runId>/original.md`. Do not change this copy after this step.
4. Read the prompt. Use `guides/<guide>/prompt.md` if it exists. If not, use `prompts/update-assessment.md`. Fill the placeholders from `guide.json`.
5. Do the assessment that the prompt describes. Start with the OpenAlex workflow below, then use web search and other scholarly sources. Record every search in `report.md`, part 7.
6. Write `report.md` with parts 1 to 8.
7. Write `run.json`. Obey part 9 of the prompt and `schema/run.schema.json`. Then replace the metadata of the scholarly sources with the OpenAlex records:

   ```bash
   node openalex.mjs sync runs/<guide>/<runId>
   ```

   If the command reports a problem, correct the source and run the command again.
8. Run the check:

   ```bash
   node server.mjs --check runs/<guide>/<runId>
   ```

9. If the check shows a problem, correct `run.json` and run the check again.
10. Rebuild the run list:

    ```bash
    node server.mjs --index
    ```

11. Tell the user the verdict, the number of changes, and the command to open the interface: `node server.mjs`.

### OpenAlex workflow

Use `openalex.mjs` in step 5. It needs no account. OpenAlex is the source of record for scholarly literature: journal articles, preprints, books, chapters, and conference papers. Every scholarly source in `run.json` comes from OpenAlex, so that all citations have the same form and every work has an ID and a citation count.

1. If `guide.json` has a DOI, list the works that cite the guide:

   ```bash
   node openalex.mjs citing <guide> --limit 50
   ```

2. Search for each central topic of the guide. The command shows only works after the guide date:

   ```bash
   node openalex.mjs search <guide> "<terms>" --limit 25
   ```

3. For each scholarly source that you use, get its record:

   ```bash
   node openalex.mjs work <doi> --json
   ```

   - Copy `citation`, `doi`, `openalex`, `year`, `venue`, and `citedByCount` into the source in `run.json`. Do not write the citation yourself. The `citation` is APA 7 from the DOI registry, or from OpenAlex if the work has no DOI.
   - A result from `work` counts as an opened registry entry for `verified`.
   - If `retracted` is true, do not use the work as evidence. Say so in the report.
   - `openalexType` is not the same as `type`. Decide `type` yourself. A journal article is not always peer-reviewed.
   - If you found a work outside OpenAlex (for example, through web search), look it up with `work` before you cite it.
4. For each source with an open access PDF (`oaPdf`), archive the PDF:

   ```bash
   node openalex.mjs fetch <doi>
   ```

   If the command finds no PDF, continue. Do not try other download sites. Tell the user which sources have no PDF, so the user can add them with `node openalex.mjs add <file.pdf> <doi>`.
5. Record the OpenAlex searches, with terms and result counts, in `report.md`, part 7. Add "OpenAlex" to `search.databases`.

6. After you write `run.json`, run `sync` (Task 2, step 7). The command does these things for each source with a DOI or an OpenAlex ID:
   - It replaces `citation`, `year`, `venue`, `openalex`, and `citedByCount` with the record.
   - It does not change a source if the DOI belongs to a different work, or if the DOI is not in OpenAlex.
   - It reports a peer-reviewed, preprint, or book source without a DOI.

Web pages, software documentation, standards, laws, and institutional pages are not in OpenAlex. Cite them from the page itself, with `url` and without `openalex`. Some books and reports are also missing from OpenAlex. Do not treat "not in OpenAlex" as "does not exist". In that case, write the citation in APA 7 yourself and say so in `verificationNote`.

The metadata in the registry is as the publisher registered it. Some titles are short (no subtitle) or in title case. Do not correct them by hand. The reviewer sees the DOI link.

### Rules for changes

Each item in `changes` is a comment or a correction. Part 9 of the prompt defines both.

- Write a finding about content as a comment (`"type": "comment"`). A comment does not change the text. The editor reads it like a comment in Word.
- Write a correction (`"type": "correction"`) only for an error of form: a typing error, a spelling, grammar, or punctuation error, or a broken cross-reference. If the fix changes the meaning, write a comment.
- Copy `original` exactly from `original.md`, including Markdown characters and line breaks. Do not correct typing errors in the copy.
- Select a passage that occurs exactly one time. If a sentence occurs two times, include more of the text around it.
- For a comment, select the shortest passage that the comment refers to: one sentence, one list item, or one reference entry.
- Do not let two items overlap.
- Keep the voice, terms, and Markdown style of the guide in `suggestion` and `proposed`.
- If a comment adds a citation, write a second comment on the reference list for the reference entry.
- Use `significance` and `direction` as part 2 and part 4 of the prompt define them.
- Do not propose a change only because newer literature exists. Part 6 of the prompt gives the threshold.

### Rules for sources

- Do not invent a citation, DOI, date, page number, or finding.
- Take every scholarly source from OpenAlex (see "OpenAlex workflow"). Use a web page as a source only for material that is not scholarly literature.
- Set `verified: true` only if you opened the source or its registry entry (doi.org, Crossref, publisher page, EUR-Lex, W3C) in this run.
- If you could not open the source, set `verified: false`. Write what you could not check in `verificationNote`.
- Set `type` correctly. A preprint is not `peer-reviewed`.

## Task 3: Adopt a reviewed run

Do these steps only when the user asks you to adopt or publish a reviewed run.

1. Make sure that `runs/<guide>/<runId>/decisions.json` has no change with status `pending`. If it has, tell the user and stop.
2. Copy `runs/<guide>/<runId>/revised.md` to `guides/<guide>/guide.md`.
3. Run `node server.mjs --index`.
4. Tell the user which files changed. Do not commit unless the user tells you to.

## Do not

- Do not edit `original.md`, `decisions.json`, or `revised.md` of a run that a human started to review.
- Do not edit `guides/<guide>/guide.md` during a run.
- Do not change the interface files (`index.html`, `app.js`, `docx.js`, `styles.css`, `server.mjs`) during a run.
