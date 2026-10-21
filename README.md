# Guidecheck

Guidecheck keeps published guides current. An AI agent compares a guide with the literature after its publication date and proposes specific, sourced changes. You check each change in a web interface, then approve, edit, or reject it.

- The agent (Claude Code or Codex) does the research and writes the proposals in this repository.
- The web interface shows each proposal as proofreader's marks on the original text, with the sources next to it.
- Your decisions go into the repository as plain files. Git keeps the history.

Live demo (read-only): https://eyecatch3r.github.io/guidecheck/

## How it works

1. You add a guide as a PDF. The agent converts it to Markdown.
2. You tell the agent to check the guide. The agent follows the base prompt in [`prompts/update-assessment.md`](prompts/update-assessment.md).
3. The agent writes a run: a full report, a verdict, a list of proposed changes, and a list of sources.
4. You open the interface. You decide each change. The interface writes `decisions.json` and `revised.md`.
5. You adopt the revised guide and commit.

The agent never changes a published guide without your decision.

## Requirements

- [Node.js](https://nodejs.org/) 18 or later. The server uses the standard library only. You do not need `npm install`.
- An AI coding agent: [Claude Code](https://docs.claude.com/en/docs/claude-code) or [Codex](https://github.com/openai/codex).
- Optional, for PDF conversion: `markitdown` (Python) or `pdftotext` (Poppler). Claude Code can also read PDF files directly.

## Start the interface

1. Open a terminal in the repository folder.
2. Start the server:

   ```bash
   node server.mjs
   ```

3. Open http://localhost:4173 in your browser.

The server listens on your computer only (`127.0.0.1`). To use a different port, set the `PORT` environment variable.

## Add a guide

1. Put the PDF in the repository folder.
2. Tell the agent to add the guide.
   - In Claude Code, type:

     ```text
     /add-guide path/to/guide.pdf survey-sampling
     ```

   - In Codex, write: "Add the guide path/to/guide.pdf as survey-sampling. Obey AGENTS.md."

3. Read `guides/<guide>/guide.md`. Compare it with the PDF. Correct conversion errors before the first run.
4. Check the metadata in `guides/<guide>/guide.json`, especially the publication date. The agent searches for literature after this date.

Do not commit a PDF if its license does not permit it. Only `guide.md` and `guide.json` are necessary.

## Run an update check

1. Tell the agent to check the guide.
   - In Claude Code, type:

     ```text
     /check-guide survey-sampling
     ```

   - In Codex, write: "Run an update check on survey-sampling. Obey AGENTS.md."

2. Wait until the agent reports the verdict and the number of changes.
3. Open the interface, or reload it if it is open.

To adapt the prompt for one guide, copy `prompts/update-assessment.md` to `guides/<guide>/prompt.md` and edit the copy. For example, set a narrower field or add guide-specific criteria. Do not remove part 9 of the prompt. The interface needs it.

## Review a run

The interface has three views:

| View | Content |
|---|---|
| Changes | One change at a time: proof-marked text, the agent's reason, decision buttons, and the sources |
| Assessment | Verdict, timeliness by dimension, ranked developments, what does not need to change, search strategy, all sources, and the full report |
| Full text | The complete guide with every change in place. Click a change to open it. |

How to read the marks:

| Mark | Meaning |
|---|---|
| Struck text | The agent proposes to remove this text |
| Blue text | The agent proposes to add this text |
| Red text | Your own edit |
| `OK` stamp | You approved the change |
| `stet` stamp | You rejected the change ("let it stand") |
| `amended` stamp | You edited the proposed text |
| Dot size | Significance: major, significant, relevant. An open dot is incremental. |

To decide a change:

1. Read the marked text and the reason.
2. Check the sources in the right column. A source with a yellow "Not verified" label needs your check.
3. Do one of these actions:
   - Press `A` to approve the change.
   - Press `E` to edit the proposed text. Press `Ctrl+Enter` to save your edit.
   - Press `R` to reject the change.
4. Optional: press `N` and write a note.

After a decision, the interface opens the next change that is not decided. Press `U` to undo a decision. Press `J` and `K` to move between changes. Press `S` to show the original and the proposal side by side.

Write your name in the top bar before you start. The interface records it with each decision.

## Save decisions

- **Local server (`node server.mjs`):** The interface saves each decision to `runs/<guide>/<runId>/decisions.json` and `revised.md`. The top bar shows "Saved to repository".
- **GitHub Pages (read-only):** The interface keeps decisions in your browser. Select **Export**, download `decisions.json` and `revised.md`, put both files in the run folder, and commit them.

## Adopt the revised guide

1. Make sure that every change of the run has a decision.
2. Tell the agent: "Adopt run `<runId>` of `<guide>`." The agent copies `revised.md` to `guides/<guide>/guide.md`.
3. Commit the changed files.

## Repository structure

```
AGENTS.md                      instructions for the AI agent (Claude Code reads it through CLAUDE.md)
prompts/update-assessment.md   base prompt for every run
schema/run.schema.json         format of run.json
guides/<guide>/                guide.md, guide.json, optional prompt.md
runs/<guide>/<runId>/          original.md, report.md, run.json, decisions.json, revised.md
runs/index.json                list of runs for the interface
index.html, app.js, styles.css interface (no build step)
server.mjs                     local server, run check, and index builder
.claude/commands/              /add-guide and /check-guide for Claude Code
```

## Check a run

The agent runs this check after each run. You can also run it yourself:

```bash
node server.mjs --check
```

The check makes sure that every change refers to text that exists exactly one time in the original, that no two changes overlap, that every source ID exists, and that every change above "incremental" has a source.

If you add, move, or delete a run by hand, rebuild the run list:

```bash
node server.mjs --index
```

## Publish on GitHub Pages

1. On GitHub, open **Settings** > **Pages** for the repository.
2. Under **Build and deployment**, set **Source** to "Deploy from a branch".
3. Set the branch to `main` and the folder to `/ (root)`. Select **Save**.

GitHub Pages shows the interface in read-only mode. Decisions saved through the local server appear on the site after you commit and push them.

## About the demo

The guide "Web Surveys: A Practical Guide (demo)" and its run are synthetic. The guide is not a real publication. The sources in the demo run are real publications. An agent checked their DOIs and registry entries on 2026-10-21. One source is deliberately marked "Not verified" to show that state.

## Limits

- The interface compares text. It does not show figures or formulas from the PDF.
- One reviewer per run at a time. Two people who edit the same run at the same time overwrite each other's decisions.
- The quality of a run depends on the agent's literature search. Always check the sources of a change before you approve it.

## License

Code: MIT. See [LICENSE](LICENSE). Fonts: SIL Open Font License, see [`fonts/OFL.txt`](fonts/OFL.txt).
