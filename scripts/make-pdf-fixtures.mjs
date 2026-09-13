// Writes the PDF fixtures the extraction tests read, into tests/fixtures/pdf/.
//
// Run with: node scripts/make-pdf-fixtures.mjs
//
// Why this exists rather than a PDF-writing dependency: the fixtures have to be
// exact. A test that asserts extraction is character-identical to a text layer is
// worth nothing unless the text layer is known character for character, and the
// only way to know that is to lay the bytes down by hand. Everything below is the
// PDF format at the level the specification describes it: numbered objects, a
// cross-reference table, a trailer, and a content stream of text-showing operators.
// No library is involved on either side of the test.
//
// The awkward characters are the point. A PDF producer emits a ligature as one
// glyph and uses a non-breaking space freely, and a citation that cannot survive
// those is a citation that fails on real documents (ADR 0001). So the offer letter
// fixture carries an em dash, curly quotation marks, a curly apostrophe, an fi and
// an fl ligature and a non-breaking space, and it carries them the way a real
// producer would: the ligatures through an /Encoding /Differences entry naming the
// standard glyph, the non-breaking space through a /ToUnicode CMap.
//
// `tests/pdf-extraction.test.ts` writes out what it expects to read back, line by
// line, as its own literal. It does not import anything from this file. If the
// encoding table here and the expectation there ever disagree, the test fails,
// which is the check worth having.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures", "pdf");

// ── the PDF container ─────────────────────────────────────────────────────────

const latin1 = (text) => Buffer.from(text, "latin1");

/**
 * Lays out numbered objects, a cross-reference table with real byte offsets, and a
 * trailer. `objects` is 1-indexed by position: object 1 is the catalogue.
 * A string entry is a bare object; `{ dict, stream }` is a stream object, and its
 * /Length is measured rather than guessed.
 */
function pdf(objects, extraTrailer = "") {
  const parts = [];
  let at = 0;
  const push = (buffer) => {
    parts.push(buffer);
    at += buffer.length;
  };

  push(latin1("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n"));

  const offsets = objects.map((object, index) => {
    const offset = at;
    const number = index + 1;
    if (typeof object === "string") {
      push(latin1(`${number} 0 obj\n${object}\nendobj\n`));
    } else {
      const body = Buffer.isBuffer(object.stream) ? object.stream : latin1(object.stream);
      push(latin1(`${number} 0 obj\n<< ${object.dict} /Length ${body.length} >>\nstream\n`));
      push(body);
      push(latin1("\nendstream\nendobj\n"));
    }
    return offset;
  });

  const xrefAt = at;
  const rows = offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  push(
    latin1(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${rows}` +
        `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${extraTrailer} >>\n` +
        `startxref\n${xrefAt}\n%%EOF\n`,
    ),
  );

  return Buffer.concat(parts);
}

/** A string inside a content stream. Only three characters need an escape. */
const literal = (text) => text.replace(/([\\()])/g, "\\$1");

// ── the text layer ────────────────────────────────────────────────────────────

/**
 * Every character in the fixtures that is not plain ASCII, and the byte the
 * content stream carries it as.
 *
 * 0x92 to 0x97 are WinAnsiEncoding's own codes for the punctuation, which is what a
 * word processor writing a PDF uses. 0x01 to 0x03 are outside it, so the font
 * declares them: the two ligatures by glyph name, and the non-breaking space by
 * Unicode value through /ToUnicode, which is the only way a PDF can say "this is
 * U+00A0 and not a space".
 */
const GLYPH_CODES = {
  "’": 0x92, // curly apostrophe
  "“": 0x93, // opening curly quotation mark
  "”": 0x94, // closing curly quotation mark
  "—": 0x97, // em dash
  "ﬁ": 0x01, // fi ligature
  "ﬂ": 0x02, // fl ligature
  " ": 0x03, // non-breaking space
};

function encodeLine(line) {
  let out = "";
  for (const character of line) {
    const code = GLYPH_CODES[character];
    if (code !== undefined) {
      out += String.fromCharCode(code);
      continue;
    }
    if (character.codePointAt(0) > 0x7e) {
      throw new Error(`no glyph code for ${JSON.stringify(character)}`);
    }
    out += character;
  }
  return out;
}

const TO_UNICODE = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<00> <FF>
endcodespacerange
1 beginbfchar
<03> <00A0>
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;

const FONT =
  "/Type /Font /Subtype /Type1 /BaseFont /Helvetica " +
  "/Encoding << /Type /Encoding /BaseEncoding /WinAnsiEncoding " +
  "/Differences [1 /fi /fl /space] >> /ToUnicode 6 0 R";

/**
 * One page's content stream: one text-showing operator per line, on a baseline
 * fourteen points below the one before it. One operator per line is deliberate.
 * A line split across operators would make PDF.js insert spacing of its own where
 * the parts meet, and the point of the fixture is that the expected text is known.
 */
function textStream(lines) {
  const shown = lines.map((line) => `(${literal(encodeLine(line))}) Tj T*`);
  return ["BT", "/F1 11 Tf", "14 TL", "72 720 Td", ...shown, "ET"].join("\n");
}

// ── the documents ─────────────────────────────────────────────────────────────

/**
 * A take-it-or-leave-it offer letter across two pages, ending in a signature
 * block so that the completeness reading has something real to find.
 */
const OFFER_LETTER = [
  [
    "MERIDIAN LABS — OFFER OF EMPLOYMENT",
    "This letter sets out the terms on which Meridian Labs offers you",
    "employment. The offer stands for five business days from the date",
    "above and is withdrawn after that without further notice.",
    "Your salary is 74,000 dollars a year, paid monthly. Meridian may",
    "change the figure at any time on thirty days written notice, and",
    "your continued work after that notice is your acceptance of it.",
    "“Confidential Information” means anything you learn here that",
    "is not public, and the obligation does not end when your",
    "employment does. Indemniﬁcation survives termination, and you",
    "will cover Meridian’s costs in any claim brought by a third",
    "party arising from your work. Notice of resignation is due",
    "within 30 days of the date you intend to leave.",
  ],
  [
    "Any dispute about this letter goes to binding arbitration in San",
    "Mateo County, and you give up the right to bring or join a class",
    "action. Meridian may amend the employee handbook, which forms",
    "part of these terms, at any time and without asking you first.",
    "Conﬂict of interest rules apply for the whole of your employment",
    "and for twelve months after it ends. Nothing in this letter is a",
    "promise of employment for any fixed term.",
    "ACCEPTED AND AGREED",
    "Signature: ______________________________  Date: ______________",
    "Print name: __________________________________________________",
  ],
];

/** A grayscale square, small enough to read as bytes and enough to be an image. */
const IMAGE_BYTES = Buffer.from(Array.from({ length: 16 }, (_unused, index) => (index * 16) % 256));
const IMAGE_DICT =
  "/Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceGray /BitsPerComponent 8";
const DRAW_IMAGE_FULL_PAGE = "q 612 0 0 792 0 0 cm /Im1 Do Q";

const pageDict = (resources, contents) =>
  `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
  `/Resources << ${resources} >> /Contents ${contents} 0 R >>`;

/** The offer letter: a real text layer over two pages. */
function textLayerPdf() {
  return pdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    pageDict("/Font << /F1 7 0 R >>", 4),
    { dict: "", stream: textStream(OFFER_LETTER[0]) },
    pageDict("/Font << /F1 7 0 R >>", 8),
    { dict: "", stream: TO_UNICODE },
    `<< ${FONT} >>`,
    { dict: "", stream: textStream(OFFER_LETTER[1]) },
  ]);
}

/**
 * A PDF with no text layer and no image: one page carrying a drawn rule and
 * nothing else. This is a PDF that is not a scan and still has nothing to read.
 */
function noTextLayerPdf() {
  return pdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    pageDict("", 4),
    { dict: "", stream: "0 0 0 RG 2 w 72 700 m 540 700 l S" },
  ]);
}

/** A scan: two pages, each one image drawn to the edges, no text anywhere. */
function pagesAreImagesPdf() {
  return pdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    pageDict("/XObject << /Im1 6 0 R >>", 4),
    { dict: "", stream: DRAW_IMAGE_FULL_PAGE },
    pageDict("/XObject << /Im1 6 0 R >>", 7),
    { dict: IMAGE_DICT, stream: IMAGE_BYTES },
    { dict: "", stream: DRAW_IMAGE_FULL_PAGE },
  ]);
}

/**
 * The case that is neither: a typed first page and a photographed second one.
 * There is text to read, so it is read, and the page that gave up none is
 * reported through the completeness reading.
 */
function onePageWithoutTextPdf() {
  return pdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    pageDict("/Font << /F1 7 0 R >>", 4),
    { dict: "", stream: textStream(OFFER_LETTER[0]) },
    pageDict("/XObject << /Im1 8 0 R >>", 9),
    { dict: "", stream: TO_UNICODE },
    `<< ${FONT} >>`,
    { dict: IMAGE_DICT, stream: IMAGE_BYTES },
    { dict: "", stream: DRAW_IMAGE_FULL_PAGE },
  ]);
}

/**
 * A locked PDF. The /O and /U strings are not the ones an empty user password
 * would produce, so the parser asks for a password and gets none.
 */
function lockedPdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
    `<< /Filter /Standard /V 1 /R 2 /O <${"ab".repeat(32)}> /U <${"cd".repeat(32)}> /P -1 >>`,
  ];
  const id = "0102030405060708090a0b0c0d0e0f10";
  return pdf(objects, ` /Encrypt 4 0 R /ID [<${id}> <${id}>]`);
}

/** Not a PDF at all. A reader picks the wrong thing; Redline says so. */
function notAPdf() {
  return latin1("This is a text document that somebody named .pdf. It has no header.\n");
}

// ── write them ────────────────────────────────────────────────────────────────

const FIXTURES = {
  "text-layer-offer-letter.pdf": textLayerPdf(),
  "no-text-layer.pdf": noTextLayerPdf(),
  "pages-are-images.pdf": pagesAreImagesPdf(),
  "one-page-without-text.pdf": onePageWithoutTextPdf(),
  "locked.pdf": lockedPdf(),
  "not-a-pdf.pdf": notAPdf(),
};

mkdirSync(OUT, { recursive: true });
for (const [name, bytes] of Object.entries(FIXTURES)) {
  writeFileSync(join(OUT, name), bytes);
  console.log(`  wrote ${name}  ${bytes.length} bytes`);
}

const characters = OFFER_LETTER.flat().join("\n").length;
console.log(`\n  the offer letter's text layer is ${characters} characters over 2 pages`);
