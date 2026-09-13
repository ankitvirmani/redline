/**
 * The labelled corpus, checked with no model and no network.
 *
 * `npm run eval` costs money and `npm test` does not, so everything about the corpus
 * that can be established without a model is established here, on every commit. The one
 * that matters most is the same rule the product rests on, turned on the corpus itself:
 * every sentence a sidecar names is in its document character for character, and exactly
 * once. A sidecar sentence that has drifted would report a recall miss the model never
 * made, and a number produced that way is worse than no number.
 *
 * It also holds the corpus to what the corpus claims about itself. Every document says
 * where it came from, the benign documents plant nothing, the loaded documents plant
 * something, and no entry claims to have been collected from the world, because none
 * was.
 */

import { describe, expect, it } from "vitest";

import { CLAUSE_TYPE_SLUGS } from "@/src/domain/clause-types";
import { locateSpan } from "@/src/domain/verify";
import { extract } from "@/src/extraction";
import { inventory, loadCorpus, typographyIn } from "@/scripts/eval/corpus";

const corpus = loadCorpus();

describe("the corpus", () => {
  it("holds more than the two fixtures, and holds those two", () => {
    const ids = corpus.documents.map((document) => document.id);
    expect(ids).toContain("adhesion-contract");
    expect(ids).toContain("clean-document");
    expect(corpus.documents.length).toBeGreaterThan(2);
  });

  it("says where every document came from, and claims none was collected from the world", () => {
    // The honest constraint the ticket names: real consumer contracts could not be
    // obtained, and a document claiming to be one would be the same defect class as a
    // fabricated citation. Every entry is marked, and this is the assertion that stops a
    // later one being added unmarked.
    for (const document of corpus.documents) {
      expect(["written-for-this-suite", "written-for-the-deterministic-suite"]).toContain(
        document.provenance,
      );
    }
  });

  it("carries benign documents, because clean documents staying clean is one of the tests", () => {
    const benign = corpus.documents.filter((document) => document.benign);
    expect(benign.length).toBeGreaterThanOrEqual(2);
    for (const document of benign) expect(document.planted).toEqual([]);
  });

  it("plants at least one clause in every document that is not benign", () => {
    for (const document of corpus.documents.filter((entry) => !entry.benign)) {
      expect(document.planted.length).toBeGreaterThan(0);
    }
  });

  it("holds at least one instance of each of the seven clause types", () => {
    // A type with no instances has no recall at all, which the metrics report as null
    // rather than zero. Having none in the corpus would mean the run simply says nothing
    // about that type, and all seven are meant to be measured.
    const counts = inventory(corpus);
    for (const slug of CLAUSE_TYPE_SLUGS) expect(counts[slug]).toBeGreaterThan(0);
  });

  it("holds enough instances of each type that a recall figure is not a coin toss", () => {
    // Four is the floor, not a target. The run prints the count beside every rate and
    // marks the thin ones, because a recall of 0.75 over four instances and over forty
    // are different claims.
    const counts = inventory(corpus);
    for (const slug of CLAUSE_TYPE_SLUGS) expect(counts[slug]).toBeGreaterThanOrEqual(4);
  });
});

describe("every sentence the corpus names is in its document", () => {
  for (const document of corpus.documents) {
    describe(document.id, () => {
      it("carries its own title verbatim", () => {
        expect(document.text).toContain(document.title);
      });

      it("names all seven clause types as checked", () => {
        expect([...document.checkedClauseTypes].sort()).toEqual([...CLAUSE_TYPE_SLUGS].sort());
      });

      for (const clause of document.planted) {
        it(`${clause.id} quotes its source sentence exactly once`, () => {
          const located = locateSpan(document.text, clause.sourceSentence);
          expect(located.outcome).toBe("found");
          if (located.outcome === "found") {
            expect(located.occurrences).toBe(1);
            expect(located.at).toEqual(clause.at);
            expect(document.text.slice(located.at.start, located.at.end)).toBe(
              clause.sourceSentence,
            );
          }
        });

        if (clause.exit !== null) {
          const exit = clause.exit;
          it(`${clause.id} quotes the exit the document grants exactly once`, () => {
            const located = locateSpan(document.text, exit.sourceSentence);
            expect(located.outcome).toBe("found");
            if (located.outcome === "found") expect(located.occurrences).toBe(1);
          });
        }
      }

      it("lists its planted clauses in document order", () => {
        const starts = document.planted.map((clause) => clause.at.start);
        expect(starts).toEqual([...starts].sort((left, right) => left - right));
      });

      it("gives every planted clause a distinct sentence", () => {
        // Two planted clauses sharing a sentence would make the strict matching rule
        // ambiguous: one flag would find both, or neither, depending on the order the
        // corpus happened to be listed in.
        const sentences = document.planted.map((clause) => clause.sourceSentence);
        expect(new Set(sentences).size).toBe(sentences.length);
      });

      it("quotes any merely unusual sentence it names verbatim", () => {
        for (const sentence of document.unusualButHarmless) {
          expect(document.text).toContain(sentence);
        }
      });

      if (document.questions !== null) {
        const questions = document.questions;
        it("quotes the answer sentence for every grounded question verbatim", () => {
          for (const grounded of questions.grounded) {
            expect(document.text).toContain(grounded.expectedSourceSentence);
          }
        });

        it("asks questions the document cannot answer, which is what refusal is measured on", () => {
          expect(questions.ungrounded.length).toBeGreaterThan(0);
          for (const ungrounded of questions.ungrounded) {
            expect(ungrounded.why.length).toBeGreaterThan(0);
          }
        });
      }

      it("reads as a whole document rather than a truncated one", async () => {
        // A corpus document that tripped truncation detection would put a partial
        // completeness reading next to every flag in it, and the run's numbers would be
        // measuring a document the corpus does not describe.
        const extraction = await extract({ kind: "pasted-text", text: document.text });
        expect(extraction.outcome).toBe("extracted");
        if (extraction.outcome === "extracted") {
          expect(extraction.document.completeness.level).toBe("whole");
        }
      });
    });
  }
});

describe("the characters a model tends to retype rather than copy", () => {
  it("appear in some planted sentences and not in most of them", () => {
    // Ticket 10's run dropped the same flag every time, on a sentence carrying an em
    // dash, a curly apostrophe and a non-breaking space. Real documents carry those
    // characters, so a corpus without any would measure a cleaner world than the one the
    // product ships into, and a corpus where every sentence carried them would measure
    // the typography rather than the analysis.
    const all = corpus.documents.flatMap((document) => document.planted);
    const atRisk = all.filter((clause) => typographyIn(clause.sourceSentence).length > 0);
    expect(atRisk.length).toBeGreaterThan(0);
    expect(atRisk.length).toBeLessThan(all.length / 2);
  });

  it("names the class of each one, so a drop can be reported by cause", () => {
    expect(typographyIn("a sentence with an em dash — here")).toEqual(["em-dash"]);
    expect(typographyIn("Northwind’s")).toEqual(["curly-apostrophe"]);
    expect(typographyIn("ofﬁce")).toEqual(["ligature"]);
    expect(typographyIn("plain words only")).toEqual([]);
  });
});
