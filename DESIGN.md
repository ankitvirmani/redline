---
name: Redline
description: Modular Bars. Flat unmixed inks, hard-edged bars, and one grotesque set either small and workmanlike or enormous.
colors:
  ink: "#0A0A0A"
  white: "#FFFFFF"
  cool-grey: "#E6E9EC"
  grey-line: "#C7CDD3"
  grey-text: "#4A5259"
  cyan: "#00B7FF"
  magenta: "#FF2DA1"
  yellow: "#FFD400"
  green: "#32D74B"
  ink-hairline: "#2A2A2E"
  yellow-field-text: "#5C4A00"
typography:
  display:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(2.5rem, 5.7vw, 5.25rem)"
    fontWeight: 900
    lineHeight: 0.94
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(1.75rem, 3.1vw, 2.875rem)"
    fontWeight: 900
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(1rem, 0.45vw + 0.92rem, 1.0625rem)"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  document:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "0.13em"
  action:
    fontFamily: "Archivo, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.055em"
rounded:
  none: "0"
spacing:
  hair: "0.25rem"
  xs: "0.625rem"
  sm: "1rem"
  md: "1.75rem"
  lg: "2.5rem"
  pad: "clamp(1.25rem, 3.2vw, 3.25rem)"
  section-y: "clamp(3rem, 6vw, 5.5rem)"
  rail: "clamp(17rem, 22vw, 21rem)"
  bar-overhang: "7rem"
components:
  button-primary:
    backgroundColor: "{colors.cyan}"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.none}"
    padding: "0.875rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
  button-primary-lg:
    backgroundColor: "{colors.cyan}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "1.0625rem 1.375rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.none}"
    padding: "0.875rem 1rem"
  button-ghost-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
  flag-bar:
    backgroundColor: "{colors.magenta}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "1rem 1.125rem"
  flag-body:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0.9375rem 1.125rem 0.8125rem"
  rank-badge:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    size: "1.75rem"
  code-chip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "0 0.3rem"
  band-row:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "1.125rem 1.25rem"
  textarea-paste:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "1.125rem 1.25rem"
  rail-surface:
    backgroundColor: "{colors.cool-grey}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.pad}"
    width: "{spacing.rail}"
---

# Design System: Redline

Recorded from the shipped landing page (`landing/index.html`, `landing/styles.css`, `landing/app.js`, self-hosted `landing/fonts/archivo-latin*.woff2`). Static, no build step, no dependencies. Where the build and the direction contract disagree, this file records the build.

## Overview

**Creative North Star: "Modular Bars"**

A contract is small, plain and businesslike; the warnings that land on it are enormous. The world is built out of one part: a hard-edged rectangle of flat ink. It is the flag bar in the margin, the underline beneath a source sentence, the tab at the head of a question, the marker beside a rail item, the bar in front of a refusal, and the rotated fragment scattered at the edge of a heading. Remove every word and the system is still recognisable by the bar alone.

Nothing here softens. No radius anywhere, no gradient, no glass, no elevation, no decorative shadow, no photography, no illustration, no icon font. The only two-dimensional trick in the build is a colour bar overprinted across heading letterforms with `mix-blend-mode: multiply`, so the glyphs stay black and the counters fill with ink. Structure is carried by a 2px ink keyline where a boundary matters and a 1px grey hairline where it merely separates.

Density is deliberately uneven, and the unevenness is the argument. Document prose is set at 0.9375rem on a 1.72 line-height at a 26rem measure, justified and hyphenated so it reads as the legal boilerplate it is. Display type runs up to 5.25rem at weight 900 with -0.045em tracking. The reader is meant to feel the size difference between the thing they were handed and the thing being said about it.

**Key Characteristics:**
- One family, Archivo variable 400–900, self-hosted, two subsets, `font-display: swap`, `font-synthesis-weight: none`.
- Four flat inks plus ink black, cool grey and white. No tints in the palette; the sole mixture in the build is the resting state of a source-sentence underline.
- Zero corner radius, zero elevation. Every edge is a cut.
- Colour identifies; it never ranks.
- Motion is one authored moment on load, and then the page is still.
- Browser chrome is themed: yellow selection, ink scrollbar, ink focus ring, cyan caret.

## Colors

Four saturated inks that mix with nothing, on a field of true white, cool grey and near-black.

### Primary
- **Signal Cyan** (`{colors.cyan}`): the primary action's fill, the whole-section field behind the severity-ranking bands, the focus outline on the paste field, the text caret, one flag identity, and the second overprint bar. It is the product's action colour, always under black text.
- **Contract Ink** (`{colors.ink}`): all body and display type on light fields, the rank badge, the code chip, the 2px structural keyline, the inverted refusals section, the footer, the scrollbar thumb, the focus ring, and the left-edge tab of an active source sentence.

### Secondary
- **Redline Magenta** (`{colors.magenta}`): the first flag identity, the highlight behind "this contract" in the display headline, the first overprint bar, and the first refusal bar. The most-used ink after cyan and never a severity signal.
- **Notice Yellow** (`{colors.yellow}`): the third flag identity, the whole-section field behind the paste form, and the text-selection background. Under black text only.

### Tertiary
- **Check Green** (`{colors.green}`): the rarest ink. It appears as one anatomy marker, one refusal bar, and scattered fragments. It is a fourth identity slot, not a "safe" or "pass" colour; the build never uses it to mean good.

### Neutral
- **Cool Grey** (`{colors.cool-grey}`): the left rail's field, the inset external-context block, the citation blockquote behind a question's source sentence, footer prose, and the scrollbar track. The reading field itself is `{colors.white}`, never grey.
- **Hairline Grey** (`{colors.grey-line}`): 1px separators inside the rail, between anatomy rows, and the resting colour of a source-sentence underline where no flag is bound.
- **Muted Ink** (`{colors.grey-text}`): secondary prose: section subheads, rail notes, field labels, flag codes. Passes AA on both white and cool grey.
- **Inverted Hairline** (`{colors.ink-hairline}`): the only separator on the near-black refusals field.
- **Yellow-Field Ink** (`{colors.yellow-field-text}`): secondary prose on the yellow paste section, where Muted Ink would not hold contrast.

### Named Rules

**The Identity-Not-Severity Rule.** Colour tells one flag from another and never encodes how bad it is. Severity is carried by the word ("Critical", "High") and by list order. The page states this rule in its own copy and obeys it: flag 1 is magenta, flag 2 is cyan, flag 3 is yellow, and two of those three are Critical. This is also the WCAG 2.2 AA commitment in `PRODUCT.md`, where severity must never be carried by colour alone. Audit test: recolour every bar at random; if the ranking survives, the rule holds.

**The Black-On-Every-Ink Rule.** Black text sits on cyan, magenta, yellow, green, cool grey and white. White text sits only on ink black. White on cyan fails contrast and does not appear in the build. There is no exception and no "large text" exemption.

**The Unmixed Ink Rule.** Inks are used at full saturation, flat, never gradiented, never overlaid on each other, never given a transparent variant. The one mixture in the shipped build is deliberate and confined: a source-sentence underline rests at 34–40% ink mixed into white and goes to full saturation when its flag is selected, so the at-rest document does not shout. The direction contract said "no tint"; the build ships this one, scoped to that single state.

## Typography

**Display Font:** Archivo (self-hosted variable, 400–900; fallback `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`)
**Body Font:** Archivo, same file
**Label / Mono Font:** none. Numerals use `font-variant-numeric: tabular-nums` on ranks, counters and codes instead of a second family.

**Character:** One grotesque doing two opposite jobs. At 400 and 0.9375rem it is anonymous office prose, the voice of the document. At 900 with negative tracking and sub-1 line-height it is a poster. Nothing in the ramp is decorative or calligraphic, and there is no italic.

### Hierarchy
- **Display** (900, `clamp(2.5rem, 5.7vw, 5.25rem)`, 0.94, -0.045em): the fold headline only, capped at `min(22ch, 72%)` measure, set as three block lines. A second display size (900, `clamp(2rem, 4.4vw, 3.75rem)`, 0.98, -0.04em, 26ch) carries the paste section's heading.
- **Headline** (900, `clamp(1.75rem, 3.1vw, 2.875rem)`, 1.02, -0.035em, `text-wrap: balance`): every section heading. The refusals list is a headline-weight list in its own right (800, `clamp(1.25rem, 2.3vw, 2rem)`, 1.14, -0.03em), because the refusals are the copy and are set as large as headings.
- **Title** (800, 1.375rem, 1.1, -0.02em): anatomy row headings. Smaller titles at 900/1.1875rem (band headings) and 800/1.25rem (a question) share the register.
- **Body** (400, `clamp(1rem, 0.45vw + 0.92rem, 1.0625rem)`, 1.5): prose, capped at 58–74ch depending on section. Emphasis prose runs 500–600 at 1rem, 1.125rem rather than changing size.
- **Document** (400, 0.9375rem, 1.72, justified, `hyphens: auto`, `hyphenate-limit-chars: 9 4 4`, measure 26rem): reserved for quoted document text. Justification and hyphenation are dropped below 520px, where they break down.
- **Label** (900, 0.6875–0.75rem, 0.13–0.14em, uppercase): rail section labels, severity words, field keys, the example-document chip. Always a real heading or a real key, never decoration.
- **Action** (700, 0.9375–1rem, 0.055em, uppercase): buttons and the skip link. The wordmark is 800 at 0.11em.

### Named Rules

**The Two-Register Rule.** Type is either small and workmanlike (0.6875–1.125rem) or enormous (1.75rem and up at weight 800–900). The middle is empty on purpose. When a new element needs emphasis, move it to the other register or change weight; do not invent a 1.5rem heading.

**The Measure Rule.** Quoted document text is held at 26rem no matter how wide the field gets, because the point is that a contract is small. Everything else caps between 52ch and 74ch.

## Layout

A two-column shell: a fixed-proportion left rail at `{spacing.rail}` against `minmax(0, 1fr)` of white reading field, separated by a 1px hairline. The rail is full-height with a sticky top group holding the mark, the lede, and the primary action, so the action is above the fold at every width.

Main content is a vertical stack of full-bleed sections, each padded `{spacing.section-y}` block and `{spacing.pad}` inline, and separated either by a 2px ink keyline or by a colour change of the whole field (near-black refusals, cyan ranking, yellow paste). Sections do not sit in cards inside a container; the section *is* the container.

The fold's demonstration is a two-column stage: document at `minmax(0, 1fr)`, flags at `minmax(0, 25rem)`, 3.5rem gutter. Flag bars are 7rem wider than their column and pulled left by the same amount, so each bar overhangs the gutter and sits partly over the document's margin. An SVG keyline is drawn at runtime from the open bar, through the gutter, to the right edge of the sentence it quotes, routed so it never crosses a word.

Rhythm is coarse and small-numbered: 0.25rem for stacked bars, 0.625rem, 1rem inside components, 1.5–1.75rem between rows, 2.5rem under a section subhead.

Breakpoints, in the order the build declares them:
- **1100px and below:** the stage collapses to one column, flag bars lose their 7rem overhang and their full-width pull, the runtime keyline is hidden entirely, and band rows restack.
- **860px and below:** the rail becomes a static top band with a 2px ink bottom border, the rail actions go horizontal, scattered fragments are hidden, and the fold's truth-guard chip reorders *above* the headline it qualifies.
- **520px and below:** document prose goes left-aligned and unhyphenated, and a flag bar's type wraps to its own row.

### Named Rules

**The Overhanging Bar Rule.** Above 1100px a flag bar breaks its own column by `{spacing.bar-overhang}` into the gutter. The bar is not contained by the grid; it lands on the page. Below 1100px it snaps flush, because an overhang with no gutter is just a broken layout.

**The Full-Bleed Section Rule.** A change of subject is a change of field colour or a 2px keyline across the full width. No section sits inside a centred max-width wrapper, and nothing is ever a card on a background.

## Elevation & Depth

There is no elevation. Nothing floats, nothing lifts, no surface is tinted to sit above another, and there is no blur, no glass, no ambient shadow anywhere in the build. Depth is entirely positional: what is in front is opaque, larger, and overlapping. The flag bar overhangs the document, the display headline sits at `z-index: 1` over scattered fragments, the runtime keyline sits above both at `z-index: 3`.

`box-shadow` appears exactly once, and not as depth. An active source sentence gets `box-shadow: -0.35rem 0 0 var(--ink)`: a zero-blur, zero-spread, single-axis solid rectangle used to draw the ink tab down the left edge of every line fragment, since a border cannot follow `box-decoration-break: clone`. It is a drawn bar, not a lift.

### Shadow Vocabulary
- **Left-edge tab** (`box-shadow: -0.35rem 0 0 <ink>`): the only shadow in the system. Draws the ink tab on an active source sentence. Transitions from `transparent` over 220ms.

### Named Rules

**The Flat-Field Rule.** No element in this system casts a shadow. `box-shadow` is permitted only with zero blur and zero spread, as a way of drawing a solid rectangle that a border cannot reach. Any blurred, offset, or lifting shadow is out of world.

## Shapes

Zero radius, everywhere, on everything: buttons, text field, rank badge, code chip, flag body, bars, fragments. Every corner is a 90-degree cut, and `rounded.none` is the only radius token because it is the only one the build contains.

Borders come in two weights with two distinct jobs. A **2px ink keyline** marks structure and interaction: the button outline, the paste field, an open flag's body, the underline of the document's title, the section boundary, the runtime keyline, and the rail's bottom edge in stacked layout. A **1px grey hairline** (`{colors.grey-line}`, or `{colors.ink-hairline}` on the near-black field) merely separates list rows. There is no third weight.

The recurring silhouette is the rectangle at three scales: the oversized bar (a whole row, 1.25rem of pure ink-colour height in the refusals list), the medium block (the 0.5rem underline, the 0.5rem question tab, the 2.75rem anatomy marker), and the fragment (rotated 0.75–3.25rem shapes scattered at -29deg to +37deg). Rotation belongs to fragments only; nothing else in the system is off-axis except the overprint bar, tilted -1.2deg and +1.4deg.

## Components

### Buttons
- **Shape:** square-cut (0 radius), 2px ink border on every variant.
- **Primary:** cyan field, black label, uppercase at 0.055em, arrow SVG pushed to the far edge by `justify-content: space-between`. Padding `0.875rem 1rem`; the large variant used at the paste form centres its content at `1.0625rem 1.375rem`.
- **Hover / Focus:** hover inverts to ink field with white label over 170ms. Focus is the global ring, not a bespoke state.
- **Ghost:** transparent field, ink border and label, inverting to ink on hover. Defined and available; the shipped landing page uses only the primary.

### Chips
- **Style:** ink field, white text, 900 weight, 0.09–0.1em tracking, uppercase, padding `0.1875rem 0.4375rem`. Two uses: the "Example document" truth-guard chip in the fold, and the `F-01` code chip appended to an active source sentence at 0.625rem.
- **State:** none. A chip is a label, never interactive.

### Cards / Containers
There are no cards. The nearest thing is an open flag's body: white, no radius, 2px ink border on three sides with the top border removed so it reads as continuous with the bar above it, padded `0.9375rem 1.125rem 0.8125rem`. Inset blocks inside it (external context) use a cool-grey fill with no border.

### Inputs / Fields
- **Style:** the paste textarea is white with a 2px ink border, square, padded `1.125rem 1.25rem`, `resize: vertical`, inheriting the body face at 1rem/1.55. Placeholder is Muted Ink at full opacity. The caret is cyan.
- **Focus:** a 3px cyan outline at zero offset, border held at ink, the field's own edge does not move.
- **Label:** always visible above the field, uppercase label register in Yellow-Field Ink.
- **Error / Disabled:** not in the build. Do not invent one; the app shell will need them designed.

### Navigation
The rail is the navigation. Mark (2.25rem ink square, white "R" at 900, plus the wordmark at 800/0.11em), one-sentence lede at 500 capped at 24ch, the primary action, then a hairline-ruled block of the seven clause types. Rail list items carry a 0.5rem × 0.1875rem ink marker at the left, which is the bar motif at its smallest. There is no horizontal nav, no dropdown, and no mobile menu: at 860px the rail becomes a stacked top band and stays fully visible.

Focus is global and unmissable: `3px solid ink` at 3px offset, switching to white inside the near-black refusals section. The skip link is an ink block that translates down into view on focus over 160ms.

### The Change Bar (signature)
The system's signature device, and the one that carries the product's rule that every flag cites its source sentence. A source sentence in the document is marked with three things at once: a **0.5rem full-saturation underline** in the flag's own ink, the **left-edge ink tab** drawn by the sole box-shadow, and the **code chip** appended inline. All three use `box-decoration-break: clone`, so every wrapped line fragment gets the tab and the underline independently, so the mark follows the text rather than boxing it. At rest the underline drops to a 34–40% mix into white and the tab goes transparent; both transition over 220ms. Selection works in both directions: a bar opens its sentence, and the sentence opens its bar and moves focus to it.

### The Tab-Bar Motif (signature)
The change bar's tab, reused at other scales so the world stays one part: a 2.75rem × 0.5rem ink tab above each question in the question box, a 0.5rem ink underline under each cited answer's blockquote, a 2px ink left border on the fold's colour note, a small ink marker on rail list items, and a `clamp(2.5rem, 6vw, 5.5rem)` × 1.25rem ink-colour bar in front of each refusal. Anything that needs to say "this line is attached to something" gets a tab.

### The Overprint Bar (signature)
A colour bar laid across heading letterforms with `mix-blend-mode: multiply` and `isolation: isolate`, sized `height: 0.875em` and overhanging the text box by 0.75rem left and 3.5rem right, rotated -1.2deg (magenta) or +1.4deg (cyan). Because it multiplies, the glyphs stay black and the counters fill with ink. In the shipped build it appears on exactly two headings; see the note at the end of this section.

### Scattered Fragments
Absolutely positioned rectangles in the four inks plus one ink-black, rotated between -29deg and +37deg, sized 0.75rem to 3.25rem, `pointer-events: none`, sitting behind the display type. They are decoration in the strict sense: `aria-hidden`, and hidden outright below 860px.

### Motion
**One authored moment.** On load, flag bars enter at -1.4deg and -1.25rem and snap to true with `cubic-bezier(.16, 1, .3, 1)` over 760ms, staggered 90ms + 110ms per bar; fragments travel from a 1.5rem/-1rem offset over 900ms on the same curve. The default state is already visible, so nothing is hidden waiting for JavaScript. Under `prefers-reduced-motion: reduce` every element is placed directly, with no transition, and the same is true with JavaScript off. After that moment the page is still: the only remaining motion is state: 170ms button inversion, 220ms change-bar and arrow rotation, 160ms skip link.

This entry-and-snap is **specific to the landing page**. The app-shell brief does not inherit it and asks for 150–250ms state-only motion on the same easing curve.

## Do's and Don'ts

### Do:
- **Do** use colour to tell one flag from another and carry severity in the word and the list order, per The Identity-Not-Severity Rule.
- **Do** set black text on cyan, magenta, yellow, green and cool grey, and reserve white text for ink black.
- **Do** keep every corner square (`0` radius) and every edge either a 2px ink keyline or a 1px grey hairline.
- **Do** mark a source sentence with the full change bar, meaning underline, left-edge tab and code chip, and let it clone across wrapped lines.
- **Do** reuse the tab-bar motif whenever a line needs attaching to something, at whatever scale the context wants.
- **Do** run the whole field to full bleed and change the field colour to change the subject.
- **Do** hold quoted document text at a 26rem measure, justified and hyphenated above 520px.
- **Do** use the glossary in `CONTEXT.md` for every visible word: reader, flag, source sentence, red line, severity, consequence.
- **Do** name a new state in words first. "Critical", "High", "Refused" carry meaning; the bar beside them only identifies.

### Don't:
- **Don't** rank anything by hue, saturation or warmth. A red bar does not mean worse than a yellow one in this system.
- **Don't** put white text on cyan, magenta, yellow or green. It fails AA and the build never does it.
- **Don't** add a gradient, a tint ramp, a translucent overlay, a blur or a glass surface. The single 34–40% mix on a resting source-sentence underline is the whole exception and it does not generalise.
- **Don't** cast a shadow. `box-shadow` is allowed only at zero blur and zero spread, to draw a solid rectangle.
- **Don't** round a corner, anywhere, at any scale.
- **Don't** add a second typeface, an italic, or a monospace family. Numerals get `tabular-nums` from Archivo instead.
- **Don't** set display type between 1.125rem and 1.75rem; the ramp is two registers with nothing between them.
- **Don't** introduce an icon font or a glyph character as an icon. Icons are inline SVG symbols with `stroke-width` 2–2.2 and square caps.
- **Don't** ship a soft-shadowed product screenshot, a feature-card row, a metric strip, or a trust-navy field. The fold's refusal of those shapes is load-bearing: Redline has no metrics and will not borrow the shape of proof.
- **Don't** carry the landing page's scatter-and-snap entrance into the app shell. Inside, motion is 150–250ms and conveys state only.
- **Don't** rotate anything except a scattered fragment or an overprint bar.

## What carries to the app shell, and what does not

Inherited whole: the palette and all its rules, the Archivo ramp, zero radius, the two border weights, the flat field, the change bar and the tab-bar motif, the cool-grey rail against a white reading field, black-on-ink and white-only-on-black, the focus ring, and the themed browser surfaces.

Landing-page only: the display register above 2.875rem, the whole-field colour sections (cyan, yellow, near-black), the scattered fragments, the overprint bar, the 7rem bar overhang, the runtime SVG keyline, and the load-time snap. The app shell inherits the world in an Operate register, where the four inks appear only as flag bars, the current selection, and state, and where the states its brief names (refused scan, low completeness, clean document, analysis in progress, refused question, empty library, no red lines) still need designing. This file does not contain them.

## Known limits in the artifact this file describes

Recorded so they are not mistaken for the system:

- **Register drift in two sections.** The anatomy list ("What a flag carries") and the question box read closer to documentation than to the world the fold establishes: hairline-ruled rows and left-aligned prose rather than bars landing on a page. Confirmed as residual after two finish reviews. This is a defect the build carries; a new surface should follow the fold's register, not these two sections.
- **Overprint applied twice.** Only two headings carry an overprinted bar. That is an inconsistency in the artifact, not a rule that the device is rare. Applying it to more headings is consistent with the system.
- **Two untokenised colours.** `{colors.ink-hairline}` and `{colors.yellow-field-text}` are written as literals in the stylesheet rather than declared as custom properties alongside the rest. They are recorded here because they are reused and legible; they should become `:root` tokens.
