/**
 * PDF text-layer extraction, inside the extraction seam.
 *
 * A reader who was sent an offer letter has a PDF, not a page they can select and
 * copy. This reads the text layer out of it, in the browser, and hands the text to
 * the same seam pasted text goes through. The bytes never leave the browser: there
 * is no upload, no route handler, no temporary file, and nothing here writes or
 * logs the bytes or the name they arrived under.
 *
 * PDF.js is the parser (`pdfjs-dist`, Mozilla's, the one Chrome's viewer is built
 * on). It is loaded by a dynamic `import` inside the one function that needs it, so
 * that a reader who pastes their document never downloads a megabyte of parser, and
 * so that importing this seam costs nothing.
 *
 * ## Character fidelity, and what it can honestly mean here
 *
 * ADR 0001 makes this the deciding property: a model's spans are checked against
 * the extracted text character for character, so a parser that folds a ligature or
 * a curly quote breaks every citation in the document silently. A PDF text layer is
 * where those characters come from in the real world, because PDF producers emit
 * ligatures as single glyphs and non-breaking spaces freely.
 *
 * So nothing here touches a character PDF.js hands over. No trim, no whitespace
 * collapse, no quote folding, no ligature expansion, no `normalize()` in any form.
 * `disableNormalization: true` on every `getTextContent` call is load-bearing:
 * without it PDF.js runs its own NFKC-style pass and `ﬁ` arrives as `fi`.
 *
 * What this function decides, and what "character-identical" therefore cannot mean:
 * PDF.js returns text as items with positions, not as a string. A PDF's text layer
 * has no lines and no paragraphs in it; it has glyphs at coordinates. So the line
 * breaks in the text that comes out of here were put there by the rule below, not
 * read out of the document, and PDF.js itself inserts a space of its own where two
 * glyphs sit far enough apart to read as separated. Character-identical means: every
 * character inside an item is passed through untouched, and the only characters this
 * code adds are the newlines the rule adds.
 *
 * The rule, in full:
 *
 * - Items are taken in the order PDF.js yields them and their strings concatenated.
 * - A single `\n` is appended after an item PDF.js marks `hasEOL`, which is how it
 *   reports that the next item sits on a new baseline. Nothing else inserts a line
 *   break, and nothing is ever inserted inside an item.
 * - Between two pages, a single `\n` is inserted, and only if the text so far does
 *   not already end in one and the page about to be added has something in it. A
 *   page break is a line break; it is not a blank line, and it is not a trailing
 *   newline on a document that did not have one.
 *
 * One class of character does not survive, and it is not this code's doing. Inside
 * the worker, before an item ever reaches the public API, PDF.js drops every
 * whitespace glyph and emits a single U+0020 in front of the next glyph that is not
 * one. Three consequences, all of them the parser's and none of them avoidable
 * through its public surface, whose `keepWhiteSpace` option `getTextContent` does
 * not forward:
 *
 * - A non-breaking space in the text layer arrives as a plain space.
 * - A run of spaces arrives as one space.
 * - Whitespace with no glyph after it, at the end of a line, arrives as nothing.
 *
 * These are recorded rather than worked around, and none of them breaks citation
 * verification, because the extracted text is the only thing a span is ever checked
 * against: reader, model and verifier all see the same plain space.
 * `tests/pdf-extraction.test.ts` asserts all three, so the day any of them changes
 * is a failing test rather than a silent change to the text every citation in the
 * product is held against.
 *
 * Two limits worth naming that are not about characters. A paragraph break is a
 * vertical gap and not a glyph, so it comes out as one newline like any other line
 * break: the shape of the document's paragraphs is not recoverable from its text
 * layer. And predefined CJK CMaps are not shipped with the app, so a document whose
 * fonts use one has no text this can read and is refused as having no text layer.
 */

import type * as PdfJs from "pdfjs-dist";

import { countCharacters, readBackPastedText } from "@/src/domain/text";

import { assessCompleteness, type PagesRead } from "./completeness";
import type { Extraction, ExtractionRejectionReason } from "./types";

/**
 * Where the browser gets the parser's worker from.
 *
 * PDF.js parses on a worker thread and needs to be told where its worker lives.
 * `new URL(..., import.meta.url)` is a request the bundler resolves, so the worker
 * is emitted as a static asset of the build with a hashed name and served from the
 * app's own origin. Nothing is fetched from a CDN and no loader package is
 * involved. In Node, where the deterministic suite runs, PDF.js loads its own
 * worker module and this is left alone.
 */
function workerSourceUrl(): string {
  return new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).href;
}

/**
 * The parser, loaded once.
 *
 * The `legacy` build, deliberately, in both the browser and Node. It is the one
 * build that runs in both, so the tests exercise the same parser a reader does;
 * the modern build needs `Promise.try`, which Node 22 has not got.
 */
let loading: Promise<typeof PdfJs> | null = null;

function parser(): Promise<typeof PdfJs> {
  loading ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    if (typeof window !== "undefined") {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSourceUrl();
    }
    return pdfjs;
  });
  return loading;
}

/** Whether an operator paints an image. A scanned page is one of these and no text. */
function imagePaintingOperators(pdfjs: typeof PdfJs): ReadonlySet<number> {
  const { OPS } = pdfjs;
  return new Set([
    OPS.paintImageXObject,
    OPS.paintImageXObjectRepeat,
    OPS.paintInlineImageXObject,
    OPS.paintInlineImageXObjectGroup,
    OPS.paintImageMaskXObject,
    OPS.paintImageMaskXObjectGroup,
    OPS.paintImageMaskXObjectRepeat,
    OPS.paintSolidColorImageMask,
  ]);
}

/**
 * What `getTextContent` hands back, taken from the parser's own signature rather
 * than from a path into its internals: the item types are not on its public
 * surface, and the surface is what should be depended on.
 */
type TextContentItem = Awaited<
  ReturnType<PdfJs.PDFPageProxy["getTextContent"]>
>["items"][number];

/**
 * One page's text, assembled from its items by the rule in this file's header.
 * Every character inside an item is passed through; the only thing added is a
 * newline where PDF.js reported the line ended.
 */
function textOfItems(items: readonly TextContentItem[]): string {
  let text = "";
  for (const item of items) {
    if (!("str" in item)) continue;
    text += item.str;
    if (item.hasEOL) text += "\n";
  }
  return text;
}

/** The pages' text joined into the document, one newline at a page break. */
function joinPages(pages: readonly string[]): string {
  let text = "";
  for (const page of pages) {
    if (page.length === 0) continue;
    if (text.length > 0 && !text.endsWith("\n")) text += "\n";
    text += page;
  }
  return text;
}

/**
 * Why a PDF that parsed cleanly still has nothing to read.
 *
 * The two cases are told apart by what the pages paint. A page that gave up no text
 * and paints an image is a scanned or photographed page; a page that gave up no
 * text and paints nothing is a PDF with no text layer in it at all. The operator
 * list is only read once it is known there is no text anywhere, so the cost of
 * asking falls on documents Redline is about to refuse.
 */
async function whyNothingToRead(
  pdfjs: typeof PdfJs,
  document: PdfJs.PDFDocumentProxy,
): Promise<"pdf-is-images" | "pdf-has-no-text-layer"> {
  const painters = imagePaintingOperators(pdfjs);

  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number);
    const operators = await page.getOperatorList();
    if (operators.fnArray.some((operator) => painters.has(operator))) return "pdf-is-images";
  }

  return "pdf-has-no-text-layer";
}

/**
 * A refusal on its way out of `extractPdf`, so that the parser is torn down on
 * every path out of it rather than on some of them. Never thrown past this file.
 */
class Refused extends Error {
  constructor(readonly reason: ExtractionRejectionReason) {
    super(reason);
    this.name = "Refused";
  }
}

/** What the parser threw, as a reason a reader can be told. */
function reasonForThrow(thrown: unknown): "pdf-needs-a-password" | "pdf-unreadable" {
  const name = thrown instanceof Error ? thrown.name : "";
  return name === "PasswordException" ? "pdf-needs-a-password" : "pdf-unreadable";
}

/**
 * A PDF's bytes in, the document out, or the reason there is no document.
 *
 * Never a document with empty text: a PDF that gave up nothing is refused with the
 * reason, because empty text would be summarised, read as clean, and shown to a
 * reader with nothing to tell them there was never anything there.
 */
export async function extractPdf(bytes: Uint8Array): Promise<Extraction> {
  const pdfjs = await parser();

  const task = pdfjs.getDocument({
    // A copy, because PDF.js takes ownership of the buffer it is handed and
    // detaches it. The caller keeps whatever it was holding.
    data: bytes.slice(),
    // Errors only. Every warning this parser raises is about a resource for
    // drawing a page, and no page is ever drawn here.
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });

  try {
    const document = await task.promise.catch((thrown: unknown) => {
      throw new Refused(reasonForThrow(thrown));
    });

    const pages: string[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent({ disableNormalization: true });
      pages.push(textOfItems(content.items));
    }

    const text = joinPages(pages);

    // The same rule pasted text is held to, in the same place, so that a PDF of
    // blank pages and a paste box of spaces are refused on one test rather than two.
    if (readBackPastedText(text).kind === "nothing-pasted") {
      return { outcome: "rejected", reason: await whyNothingToRead(pdfjs, document) };
    }

    const read: PagesRead = {
      pages: pages.length,
      pagesWithText: pages.filter((page) => page.trim().length > 0).length,
    };

    return {
      outcome: "extracted",
      document: {
        text,
        characterCount: countCharacters(text),
        sourceKind: "pdf",
        completeness: assessCompleteness(text, read),
      },
    };
  } catch (thrown) {
    // A refusal this function decided on, or a PDF whose catalogue parsed and
    // whose pages did not. In the second case there is no text to hand on and no
    // honest way to say which page broke, so it is unreadable.
    return {
      outcome: "rejected",
      reason: thrown instanceof Refused ? thrown.reason : "pdf-unreadable",
    };
  } finally {
    await task.destroy();
  }
}
