# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain static HTML, CSS, and JavaScript. No build step and no npm dependencies. A small Node server (standard library only) serves the files and writes reviewer decisions into the repository. The same pages open read-only on GitHub Pages. Source: user answer, 2026-10-21.

## Users

Primary users are editors and maintainers of published methods guides at GESIS – Leibniz Institute for the Social Sciences, starting with the series GESIS Guides to Digital Behavioral Data. They open the review interface after an AI agent ran an update check on one guide. Their job is to decide, change by change, whether the proposed update is correct, sourced, and worth keeping, and to adjust the wording before they accept it.

Secondary user: the AI coding agent (Claude Code or Codex) that works in the repository. It reads the instructions, converts guides, runs the update assessment, and writes the run files that the interface displays.

## Product Purpose

Guidecheck keeps published guides current. An agent compares each guide with the literature after its publication date and proposes specific, sourced changes. The interface lets a human check each proposal against the original text and its sources, then approve, reject, or edit it. Success: a reviewer clears a run quickly, every accepted change has a verifiable source, and the approved wording reaches the Word source of the guide, with `revised.md` and `decisions.json` as the record. Source: user answer, 2026-10-27.

## Positioning

Each finding is a separate, reviewable unit. A content finding is a comment anchored to an exact passage, with significance class, evidence direction, the sources that support it, and optional suggested wording. It does not rewrite the guide; the editor decides the wording in Word. An error of form (typing, spelling, punctuation) is a correction with exact original and corrected text. The agent does not deliver one rewritten document that a human must compare by eye. Source: user request, 2026-10-27.

## Operating Context

- Guides start as PDFs. The agent converts each PDF to Markdown once. All diffs use the Markdown version.
- The agent follows the base prompt "AI-Assisted Academic Publication Update and Timeliness Assessment" (in `prompts/`). Users can adapt it per guide.
- Reviewers work at a desk, often with the original PDF and the cited papers open in other tabs.
- The published guide is edited in Word. The Word file is the master. Editors move each approved or amended change into Word with Copy text (`C`), which copies plain text without Markdown. `revised.md` and `decisions.json` are the record and audit trail, not the publication file. Source: user answer, 2026-10-27.
- Decisions are committed to the public GitHub repository, so the history of every guide revision stays visible.

## Capabilities and Constraints

- Shows runs per guide. Each run has a change list, a full editorial assessment, a search strategy, and a source list.
- Two kinds of finding. Comment: highlighted anchor passage, comment text, optional suggested wording, classification (Major, Significant, Relevant, Incremental), direction (confirms, extends, qualifies, contradicts, supersedes), priority, and linked sources; the guide text does not change. Correction: proof-marked fix of an error of form, no comment or source needed.
- Reviewer actions: accept or dismiss a comment, approve or reject a correction, edit the wording, add a note. Keyboard operation is required for fast review.
- Output: `decisions.json` and `revised.md` per run (only corrections change `revised.md`), plain-text copies of accepted comments and corrections for the Word master, and a review .docx with approved corrections applied and accepted comments as real Word comments. The .docx is built from the Markdown, not from the Word master, so its layout differs from the published guide.
- A guide can have several runs, from different agents or on the same day (hpc-germany: two Codex runs with 29 and 48 changes, one Claude Code run with 19).
- Sources carry a verification state. The agent must not invent citations, DOIs, or findings. Unverified items stay marked as unverified.
- Undecided: whether several runs per guide is the normal workflow (and so whether comparing or merging runs is a product job) or a trial; authentication; multi-reviewer workflow; automatic scheduling of runs.

## Evidence on Hand

- Real guide: `guides/hpc-germany/`, Costa, Lapesa, & Bleier (2026), "Overview of High-Performance Computing Resources for Academic Use in Germany", GESIS Guides to Digital Behavioral Data 28, DOI 10.60762/ggdbd26028.1.0. Includes `source.pdf` and `figure-1.png`. Three real runs in `runs/hpc-germany/`.
- Demo: "Web Surveys: A Practical Guide (demo)" and its run are synthetic and must stay labeled as synthetic.
- No adoption figures, reviewer counts, testimonials, or other guides beyond these. Do not invent them.

## Product Principles

1. The original text, the agent's proposal, and the reviewer's decision stay visibly separate.
2. No source, no change: a proposal without a checkable source is a weak proposal and the interface shows it as weak.
3. Speed comes from focus: one change at a time, keyboard first, nothing between the reviewer and the diff.
4. Plain files in git are the database. A person without the interface can still read every run.
