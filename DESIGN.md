---
name: Guidecheck
description: A galley-proof review desk for AI-proposed, sourced updates to published guides.
colors:
  blueline: "#1d58c0"
  blue-wash: "#e3ecfb"
  blue-wash-deep: "#c9daf6"
  red-pencil: "#b8231a"
  navy: "#132748"
  navy-2: "#1d3864"
  navy-line: "#2c4a7c"
  navy-ink: "#e9eef6"
  navy-ink-2: "#aebbd0"
  amber: "#8a4d00"
  desk: "#dde2e7"
  desk-deep: "#cfd6dd"
  sheet: "#fafbfc"
  white: "#ffffff"
  ink: "#191c22"
  ink-2: "#434955"
  ink-3: "#5d6470"
  rule: "#c5ccd4"
  rule-soft: "#e3e7eb"
typography:
  display:
    fontFamily: "Source Serif 4, Charter, Iowan Old Style, Georgia, serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.018em"
    fontVariation: "\"opsz\" 48"
  headline:
    fontFamily: "Source Serif 4, Charter, Iowan Old Style, Georgia, serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.012em"
    fontVariation: "\"opsz\" 36"
  title:
    fontFamily: "Source Serif 4, Charter, Iowan Old Style, Georgia, serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.2
  galley:
    fontFamily: "Source Serif 4, Charter, Iowan Old Style, Georgia, serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.68
    fontVariation: "\"opsz\" 18"
  body-serif:
    fontFamily: "Source Serif 4, Charter, Iowan Old Style, Georgia, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Libre Franklin, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Libre Franklin, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.03em"
  mono:
    fontFamily: "ui-monospace, Cascadia Mono, SF Mono, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 500
    fontFeature: "\"tnum\""
rounded:
  sheet: "2px"
  key: "3px"
  control: "4px"
  popover: "6px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.navy-2}"
  button-default:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  button-reject-hover:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.red-pencil}"
  button-quiet:
    textColor: "{colors.ink-3}"
    rounded: "{rounded.control}"
    padding: "8px 8px"
  shell-bar:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.navy-ink}"
    height: "52px"
    padding: "0 20px"
  galley-sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    typography: "{typography.galley}"
    rounded: "{rounded.sheet}"
    padding: "28px 44px 32px 88px"
  change-row-current:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    padding: "9px 10px"
  select-field:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "5px 6px"
  edit-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.body-serif}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
---

# Design System: Guidecheck

## Overview

**Creative North Star: "The Galley Proof"**

The agent hands in two kinds of finding. A **correction** (typing, spelling, punctuation) is a proof mark that changes the text. A **comment** is a marginal note on a highlighted passage, as in Word: it never changes the text. Each finding is a proof on a sheet. The agent marks the sheet in blueline blue. The reviewer answers in red pencil. A deletion is a struck line. An insertion is new text in the agent's ink, with a caret mark. The reviewer's decision is a hand-drawn ring in the margin with one word: "OK", "stet", or "amended". The interface does not use the red and green line diff of code review.

The world is a cool galley-white sheet on a blue-grey desk, under a deep navy shell bar. Guide text uses a serif at reading size. Interface labels use a sans. Numbers, line numbers, and identifiers use monospace. Hairline rules divide content. Slug lines carry metadata. The density is that of a working desk: three columns on wide screens, one change in front of the reviewer at a time.

The build diverges from the direction contract in two small points. The sheet has a 2px corner and the export popover has a 6px corner. The side columns are 290px and 360px, not 280px and 340px. The build is the record.

**Key Characteristics:**
- Two inks with fixed jobs: blue for the agent, red for the reviewer.
- One paper sheet on a desk. No cards.
- Hairline rules and slug lines carry structure and metadata.
- Serif for guide text, sans for interface, monospace for numbers.
- Keyboard keys are visible on every decision control.

## Colors

A cool, low-chroma paper-and-desk palette with two saturated inks and one caution color.

### Primary
- **Blueline Blue** (blueline): The agent's ink. It colors inserted text, the strike line on deletions, proof marks in the margin, links, the focus ring, and the dashed full-text hover tint (5% alpha).
- **Blue Wash** (blue-wash): The highlight of a commented passage, text selection, and the hover fill of popover items.
- **Blue Wash Deep** (blue-wash-deep): A commented passage while its balloon is pointed at, in Full text.

### Secondary
- **Red Pencil** (red-pencil): The reviewer's ink. It colors the decision ring, the decision word in the change list, the reviewer's own insertions and deletions, the stet underline, the edit field border and caret, the note focus rule, and the reject button on hover.

### Tertiary
- **Shell Navy** (navy): The shell bar, the selected tab rule, the pressed segment, and the primary button.
- **Navy Raised** (navy-2): Hover on the primary button, open menu, and run selector fill.
- **Navy Line** (navy-line): Hairline borders on controls inside the shell bar.
- **Navy Ink** (navy-ink) and **Navy Ink Muted** (navy-ink-2): Primary and secondary text on the shell bar.
- **Caution Amber** (amber): Warnings only. It marks unverified sources, missing source, missing anchor text, the synthetic demo tag, and "partly current" or "outdated" ratings.

### Neutral
- **Desk** (desk): The page ground and the change-list column.
- **Desk Deep** (desk-deep): The notice band under the strip.
- **Galley Sheet** (sheet): The paper sheet, the current change row, select fields, and default buttons.
- **White** (white): Text on navy and the edit field fill.
- **Ink** (ink), **Ink 2** (ink-2), **Ink 3** (ink-3): Text in three steps. Ink 3 is the lowest step and carries metadata, line numbers, and struck text.
- **Rule** (rule): Column dividers, control borders, and source dividers.
- **Rule Soft** (rule-soft): Hairlines inside the sheet: slug base, galley top and bottom, table rows.

### Named Rules
**The Two Inks Rule.** Blue belongs to the agent. Red belongs to the reviewer. Do not swap them. Do not use either ink for any other job.

**The Red Is Not Error Rule.** Red means a reviewer decision. Warnings and failures use Caution Amber, set between two hairline rules.

## Typography

**Display Font:** Source Serif 4 (with Charter, Iowan Old Style, Georgia)
**Body Font:** Libre Franklin (with Segoe UI, system-ui)
**Label/Mono Font:** ui-monospace (with Cascadia Mono, SF Mono, Menlo, Consolas)

**Character:** A book serif with optical sizes sets the guide text as print. A plain humanist sans sets the controls. Monospace marks everything that is a number or an identifier.

### Hierarchy
- **Display** (600, 34px, 1.12): The run verdict on the Assessment sheet. It drops to 27px on narrow screens.
- **Headline** (600, 26px, 1.2): The change title on the galley sheet. It drops to 22px on narrow screens. Full-text headings use 28px, 22px, and 18px in the same weight.
- **Title** (600, 16px, 1.2): The guide name in the run strip.
- **Galley** (400, 18px, 1.68, max 70ch): Proof-marked guide text. It is 16.5px in split view and 17px on narrow screens and in full text.
- **Body Serif** (400, 16px, 1.6): Rationale, edit field, assessment lists, and empty states. Full-text prose uses 17px/1.65 at max 70ch.
- **Body** (400, 14px, 1.45): All interface text, buttons, and the change list.
- **Label** (600, 12px, 0.03em, sentence case): Section headings inside the sheet and the side column. Galley column headings use 11.5px.
- **Mono** (500, 12px, tabular figures): Change numbers, line numbers, source IDs, DOIs, run IDs, and keyboard keys (11px).

### Named Rules
**The Print and Desk Rule.** Text from the guide or the agent's argument is serif. Text that operates the tool is sans. Do not set guide text in sans.

**The Numbers Are Mono Rule.** Change numbers, line ranges, counts in position, and source identifiers are monospace.

## Layout

The Changes view is a three-column grid under a 52px shell bar and a 50px run strip: change list (290px), galley desk (flexible), sources (360px). Each column scrolls on its own. The sheet sits centered on the desk at max 860px, with a wide left margin (88px) for change number, line range, proof marks, and the reviewer's ring.

At 1180px and below, the sources column moves under the sheet and the list narrows to 250px. At 760px and below, the layout is one column. The shell bar wraps and the run selector takes a full row. The change list becomes a horizontal scroll-snap strip of bordered rows at 78% width. Margin marks move into a row above the text. Keyboard hints hide.

The spacing rhythm is small and tight: 6px, 8px, 14px, 20px, and 28px carry most gaps. The Assessment and Full text views use one wider sheet (max 920px, 40px 64px padding).

## Elevation & Depth

The system is flat except for paper. The desk, columns, and shell bar have no shadow. Only paper objects that sit on the desk cast a soft two-layer shadow: the galley sheet and the export popover.

### Shadow Vocabulary
- **Paper** (`box-shadow: 0 1px 2px rgb(0 0 0 / .07), 0 6px 18px -6px rgb(0 0 0 / .16)`): The galley sheet and the export popover.

### Named Rules
**The Paper Only Rule.** A shadow means "a sheet of paper on the desk". Do not put shadows on buttons, rows, or columns.

## Shapes

Corners are nearly square. Controls (buttons, selects, segmented control, edit field) use a 4px corner. Keyboard keys use 3px. The sheet uses 2px. The popover uses 6px. The change list rows are square. Structure comes from 1px hairline rules, not from boxes. Warnings sit between a top and a bottom rule in amber, with no side borders. The decision ring is an open, hand-drawn SVG loop, not a geometric circle. Significance is a filled dot whose size is the rank (11px, 8px, 5px), with a hollow 6px ring for Incremental.

## Components

### Buttons
Plain, quiet, and labeled with their key.
- **Shape:** Slightly rounded (4px).
- **Primary:** Shell Navy fill, white text, 8px 14px padding, 500 weight. Hover moves to Navy Raised. Approve and Save edit use it.
- **Default:** Galley Sheet fill with a Rule border. Hover darkens the border to Ink 3.
- **Reject:** Default button. Hover turns border and text Red Pencil.
- **Quiet:** No border, Ink 3 text, 8px side padding. Undo, Cancel, previous and next.
- **Hover / Focus:** Background and border transitions at .12s. Focus is a 2px Blueline Blue outline at 2px offset on every control.
- **Content:** A 15px stroked SVG icon, the label, then a monospace key hint.

### Inputs / Fields
- **Select:** Galley Sheet fill, Rule border, 4px corner. On the shell bar: Navy Raised fill, Navy Line border, custom chevron.
- **Edit field:** White fill, 1.5px Red Pencil border, Red Pencil caret, serif 16px text. The reviewer writes in red.
- **Note and name fields:** Bottom rule only, no box. The note rule turns Red Pencil on focus.

### Navigation
- **Shell bar:** Navy, serif wordmark with an italic second half, run selector, decided count, save state, export menu.
- **Tabs:** Sans 14px, Ink 2. The selected tab is Shell Navy, 600 weight, with a 2px navy bottom rule. Each tab shows its number key.
- **Change list:** Rows in a grid of number, significance dot, title, and decision mark. Hover tints white at 45%. The current row is a Galley Sheet strip with Rule hairlines above and below.

### Galley Sheet (signature)
The sheet carries one change. A slug line on a soft hairline holds significance, direction, priority, and position. The change number sits in the left margin in monospace. The proof-marked text sits between two soft hairlines. Deletions are Ink 3 with a 2px Blueline Blue strike. Insertions are Blueline Blue with a caret mark. Rationale follows in serif, then the decision bar.

### Comment (signature)
A comment never changes the text. On the sheet, its passage is shown in its paragraph: the surrounding text in Ink 3, the anchor in Blue Wash with a 1.5px Blueline underline and a superscript monospace tag (`C06`). Under it, a one-line note says the text does not change. The comment follows under a label row that repeats the blue tag, in serif 17px Ink. Suggested wording, if any, follows as a proof-marked galley at 16.5px against the anchor; the reviewer's own wording replaces it in red. A dismissed comment loses its wash and takes the dotted red stet underline. The slug line starts with a balloon glyph and "Comment"; a correction starts with a caret and "Correction" and carries no significance, direction, or priority.

### Comment Balloons (Full text)
Full text is the guide as a Word reviewer sees it. Corrections sit inline as proof marks. Comments are highlights with a tag, and a right-hand margin (a Rule Soft hairline, 240px or wider) holds one balloon per comment: a Blueline top rule, the tag and significance dot, the decision word in red italic, a sans title, and four lines of serif comment text. Each balloon sits level with its highlight; when balloons crowd, a balloon pushed more than 24px from its highlight shows only its title and opens fully on hover. Pointing at a highlight or a balloon lights the other. A hovered balloon lifts as paper. Under 860px the margin hides and the tags remain.

### Decision Ring (signature)
The reviewer's answer is an italic serif word ("OK", "stet", "amended") inside a hand-drawn Red Pencil loop in the margin. On a new decision the loop draws itself in .42s (`cubic-bezier(.16, 1, .3, 1)`) and the word fades in over .2s. Reduced motion removes both animations.

### Source Entry
Each source is a block between Rule hairlines: monospace ID, type, serif citation, a verification line, and monospace links. Verified sources show a check in Ink 2. Unverified sources show a warning icon in amber between two rules.

## Do's and Don'ts

### Do:
- **Do** set every agent mark in Blueline Blue and every reviewer mark in Red Pencil.
- **Do** show a correction as struck text and new text with a caret, on the sheet.
- **Do** show a comment as a highlighted passage with a tag; never strike or insert text for a comment.
- **Do** put the decision word in a hand-drawn ring in the left margin.
- **Do** mark warnings in Caution Amber between a top and a bottom hairline.
- **Do** show the keyboard key on each decision control and each tab.
- **Do** set guide text in Source Serif 4 at 18px/1.68, max 70ch.
- **Do** use the Paper shadow only on the sheet and on popovers.

### Don't:
- **Don't** use a red and green line diff.
- **Don't** use red for errors or warnings. Red is the reviewer's decision.
- **Don't** wrap content in bordered or shadowed cards on the sheet. Use hairline rules.
- **Don't** use corners larger than 6px.
- **Don't** set change numbers, line numbers, or DOIs in a proportional face.
