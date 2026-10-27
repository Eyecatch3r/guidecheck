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
5. Do the assessment that the prompt describes. Use web search and scholarly sources. Record every search in `report.md`, part 7.
6. Write `report.md` with parts 1 to 8.
7. Write `run.json`. Obey part 9 of the prompt and `schema/run.schema.json`.
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
