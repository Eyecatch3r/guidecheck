# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain static HTML, CSS, and JavaScript. No build step and no npm dependencies. A small Node server (standard library only) serves the files and writes reviewer decisions into the repository. The same pages open read-only on GitHub Pages. Source: user answer, 2026-10-21.

## Users

Primary users are editors and maintainers of published methods guides at a research institute (for example, survey methodology guides). They open the review interface after an AI agent ran an update check on one guide. Their job is to decide, change by change, whether the proposed update is correct, sourced, and worth keeping, and to adjust the wording before they accept it.

Secondary user: the AI coding agent (Claude Code or Codex) that works in the repository. It reads the instructions, converts guides, runs the update assessment, and writes the run files that the interface displays.

## Product Purpose

Guidecheck keeps published guides current. An agent compares each guide with the literature after its publication date and proposes specific, sourced changes. The interface lets a human check each proposal against the original text and its sources, then approve, reject, or edit it. Success: a reviewer clears a run quickly, every accepted change has a verifiable source, and the output is a revised Markdown guide plus a decision record.

## Positioning

Each proposal is a separate, reviewable unit: exact original text, exact proposed text, significance class, evidence direction, and the sources that support it. The agent does not deliver one rewritten document that a human must compare by eye.

## Operating Context

- Guides start as PDFs. The agent converts each PDF to Markdown once. All diffs use the Markdown version.
- The agent follows the base prompt "AI-Assisted Academic Publication Update and Timeliness Assessment" (in `prompts/`). Users can adapt it per guide.
- Reviewers work at a desk, often with the original PDF and the cited papers open in other tabs.
- Decisions are committed to the public GitHub repository, so the history of every guide revision stays visible.

## Capabilities and Constraints

- Shows runs per guide. Each run has a change list, a full editorial assessment, a search strategy, and a source list.
- Per change: inline or side-by-side diff, rationale, classification (Major, Significant, Relevant, Incremental), direction (confirms, extends, qualifies, contradicts, supersedes), priority, and linked sources.
- Reviewer actions: approve, reject, edit the proposed text, add a note. Keyboard operation is required for fast review.
- Output: `decisions.json` and `revised.md` per run.
- Sources carry a verification state. The agent must not invent citations, DOIs, or findings. Unverified items stay marked as unverified.
- Undecided: authentication, multi-reviewer workflow, and automatic scheduling of runs.

## Evidence on Hand

No real guides are in the repository yet. The demo guide and demo run are synthetic and must stay labeled as synthetic. Do not invent users, institutions, or adoption claims.

## Product Principles

1. The original text, the agent's proposal, and the reviewer's decision stay visibly separate.
2. No source, no change: a proposal without a checkable source is a weak proposal and the interface shows it as weak.
3. Speed comes from focus: one change at a time, keyboard first, nothing between the reviewer and the diff.
4. Plain files in git are the database. A person without the interface can still read every run.
