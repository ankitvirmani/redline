---
version: 1
slug: "app-shell"
primary_target: "app/shell"
related_targets: []
---

Scope: the Redline app shell behind sign-in. The frame that holds paste or upload,
the result with its summary and ranked flags and clean verdict, the question box,
the reader's red lines, and the library. Visitor mode: Operate.

Brief only. No screen was built on 2026-09-11 by the owner's instruction.

Audience and product truth: `PRODUCT.md`.

Task: a reader gets a document in, reads what it costs them, checks any claim
against their own document, asks what worries them, and leaves with the document
saved. Analysis works signed out; the account gates the library and red lines.

Information the shell must always hold: which document is open, the completeness
reading for it, the summary, the ranked flags with their source sentences, the
question box, and the way back to the library.

States that carry weight here, none of them decoration: a document refused because
it is a scan or has no text layer, a partial document with a low completeness
reading, a clean document with its list of what was checked, an analysis in
progress, a question refused because the document cannot answer it, an empty
library, and a reader with no red lines. Each of these is a designed state. The
refusal messages are product copy, not error chrome.

## Direction contract

THESIS: The document is the surface and everything else is apparatus laid on it.
The shell's one idea is that a flag and its source sentence are the same module in
two places, so selecting a flag moves a bracket in the document rather than opening
a panel that hides it. It refuses the category default of a dashboard: no metric
tiles, no cards of icon plus heading, no chart of the reader's risk, because a
number about a contract is the claim this product will not make.

OWN-WORLD: Modular Bars, inherited from the landing page and read from DESIGN.md
once it is written. Restrained in the Operate register: the cool grey rail and
white reading field carry the surface, ink black type throughout, and the four flat
inks appear only as flag bars, the current selection, and state. One grotesque,
Archivo, on a fixed rem scale. Black on every ink, white only on ink black. The
landing page's scatter-and-snap motion does not come inside; motion here is
150 to 250 ms and conveys state only.

STORY: The reader arrives holding a document, gets it in, and reads downward. They
follow one flag to its sentence, believe the citation because they checked it, ask
the question that actually worries them, and save the document.

FIRST VIEWPORT: A left rail carrying the mark, the library, and the reader's red
lines. The document occupies the reading field at full measure. The completeness
reading and the summary sit above the ranked flags. A flag selected in the list
brackets its sentence in the document without covering it. The question box is
anchored where the document ends, not floating over it.

FORM: Modular Bars, from the Studio Dumbar identity system, inherited from the
landing page rather than chosen again. Seed key 184bd34d.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- How a reader combines four competing signals on one screen: severity,
  confidence, completeness, and red-line match. Open in `PRODUCT.md` and the
  hardest unanswered question on this surface.
- Whether a low completeness reading should suppress the clean verdict. Today it
  does not.
- Whether the seven clause types appear as a persistent checked-list or only on a
  clean result.
