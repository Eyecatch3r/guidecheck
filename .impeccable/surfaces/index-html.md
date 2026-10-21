---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Review interface (index.html)

Scope: the single-page review interface. Mode: Operate.
Audience: guide editors who check AI-proposed updates. Job: decide each change (approve, edit, reject) against the original text and its sources, fast, keyboard first.
Constraints: plain HTML/CSS/JS, no build. Works read-only on GitHub Pages and read-write with `server.mjs`. Demo data is synthetic and labeled.

## Direction contract

THESIS: The diff is a galley proof. Every proposed change is set as proofreader's marks on the sheet: struck deletions, caret insertions, marginal marks. The reviewer answers in a second ink: "OK" to approve, "stet" to reject, own wording to amend. Refuses the red/green line-diff of code review.

OWN-WORLD: Cool galley-white sheet on a blue-grey desk ground, deep blueline-navy shell bar. Two inks with fixed jobs: blueline blue = the agent's marks, red pencil = the reviewer's decisions. Source Serif 4 for guide text, Libre Franklin for interface labels, ui-monospace for change numbers, line numbers, DOIs. Hairline rules, no cards, no rounded panels; galley slugs carry metadata.

STORY: The reviewer sees which change is in front of them, what the guide said, what the agent proposes and why, which sources back it and whether they are verified, then decides in one key and moves to the next.

FIRST VIEWPORT: Navy bar top: product name, guide and run selectors, decided count, save state. Left column 280px: numbered change list with significance dot and decision mark. Center: the galley sheet, slug line (change number, section, significance, direction, priority), the proof-marked diff at reading size, rationale, decision bar with keys. Right column 340px: sources for this change with verification state. Tabs above the sheet: Changes, Assessment, Full text.

FORM: Galley proof with proofreader's marks; position 1 on my ordered list (chosen as IMPECCABLE'S PICK); seed key 3036fe53.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
