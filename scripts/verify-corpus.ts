/**
 * `npm run verify:corpus`: the labelled corpus, checked without a model.
 *
 * The same check `scripts/verify-fixtures.mjs` does for the two fixtures, over the
 * corpus `npm run eval` measures against. It reads no key, makes no call and costs
 * nothing, so there is no reason to discover a broken sidecar halfway through a paid
 * pass. `tests/eval-corpus.test.ts` asserts the same thing on every commit; this exists
 * because a person fixing a corpus wants to run one command and read the whole list.
 */

import { clauseType, CLAUSE_TYPE_SLUGS } from "@/src/domain/clause-types";

import { CorpusError, inventory, loadCorpus, typographyIn } from "./eval/corpus";

function say(line = ""): void {
  process.stdout.write(`${line}\n`);
}

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function main(): number {
  let corpus;
  try {
    corpus = loadCorpus();
  } catch (error) {
    if (error instanceof CorpusError) {
      say("The corpus is broken. Every problem, not just the first:");
      for (const problem of error.problems) say(`  FAIL  ${problem}`);
      return 1;
    }
    throw error;
  }

  say(`${corpus.name} v${corpus.version}`);
  say();
  say(`  ${pad("document", 30)}${pad("characters", 12)}${pad("planted", 9)}${pad("questions", 11)}provenance`);
  for (const document of corpus.documents) {
    const questions =
      document.questions === null
        ? "none"
        : `${document.questions.grounded.length}+${document.questions.ungrounded.length}`;
    say(
      `  ${pad(document.id, 30)}${pad(String(document.characterCount), 12)}${pad(
        document.benign ? "benign" : String(document.planted.length),
        9,
      )}${pad(questions, 11)}${document.provenance}`,
    );
  }

  say();
  say("  Instances per clause type:");
  const counts = inventory(corpus);
  for (const slug of CLAUSE_TYPE_SLUGS) {
    say(`    ${pad(slug, 40)}${pad(String(counts[slug]), 4)}${clauseType(slug).evidence}`);
  }

  const atRisk = corpus.documents.flatMap((document) =>
    document.planted
      .map((clause) => ({ id: `${document.id}#${clause.id}`, classes: typographyIn(clause.sourceSentence) }))
      .filter((entry) => entry.classes.length > 0),
  );
  say();
  say(`  Planted sentences carrying characters a model tends to retype: ${atRisk.length}`);
  for (const entry of atRisk) say(`    ${pad(entry.id, 40)}${entry.classes.join(", ")}`);

  say();
  say("  ok    every planted sentence, exit sentence and expected answer sentence is a unique");
  say("        verbatim substring of the document it names.");
  return 0;
}

process.exitCode = main();
