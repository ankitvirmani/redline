/**
 * `npm run smoke`: the adhesion contract through the real model, once, end to end.
 *
 * This is the owner's acceptance check for the whole build, so it is written to be
 * read by a person rather than parsed by one. It runs the four seams in the order the
 * product runs them, using the same functions the route handlers call:
 *
 *   extract (seam 1) -> analyse (seam 2, verification inside it) -> rank (seam 3)
 *   and then answerQuestion (seam 4), twice.
 *
 * Nothing here reimplements a seam. The only thing it adds is a recorder around the
 * model client, which counts the flags the model claimed so that the number dropped for
 * an unverifiable span can be reported as a difference rather than inferred. Observing
 * the boundary is not the same as doing the boundary's job: it reads the reply, it never
 * decides anything from it.
 *
 * It prints no key and no model id. The only thing it says about either variable is
 * whether it is set, and it says that only when one is not.
 *
 * It exits non-zero when the run did not do what the ticket asks of it: no key, no
 * analysis, a flag that could not show its sentence, a grounded question refused, an
 * ungrounded question answered. A smoke script that exited zero on any of those would
 * be worth nothing as an acceptance check.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { analyse, type Analysis } from "@/src/analysis";
import { readModelAnalysis } from "@/src/analysis/schema";
import { SEVERITY_BAND_READING, clauseType } from "@/src/domain/clause-types";
import { defectsRecorded } from "@/src/domain/defects";
import { extract, type ExtractedDocument } from "@/src/extraction";
import type { ModelClient, ModelReply, ModelRequest } from "@/src/model/client";
import { ModelCallError } from "@/src/model/client";
import { notConfigured, openRouterClient } from "@/src/model/openrouter";
import { answerQuestion } from "@/src/qa";
import { rank } from "@/src/ranking";

const FIXTURES = new URL("../tests/fixtures/", import.meta.url);

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, FIXTURES)), "utf8");
}

// ── printing ──────────────────────────────────────────────────────────────────

function say(line = ""): void {
  process.stdout.write(`${line}\n`);
}

function heading(title: string): void {
  say();
  say(title.toUpperCase());
  say("-".repeat(title.length));
}

/** A quoted sentence in full, wrapped to something a terminal shows whole. */
function quoted(text: string, indent = "    "): void {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    if (line.length > 0 && `${line} ${word}`.length > 92) {
      say(`${indent}${line}`);
      line = word;
      continue;
    }
    line = line.length === 0 ? word : `${line} ${word}`;
  }
  if (line.length > 0) say(`${indent}${line}`);
}

// ── the recorder ──────────────────────────────────────────────────────────────

/**
 * The real client with a count kept beside it.
 *
 * `analyse` returns verified flags and the defects raised getting there, which is
 * everything a reader needs and one number short of what the owner asked for: how many
 * flags the model claimed in the first place. That number is in the reply, so it is
 * read from the reply, with the seam's own reader so that this file holds no second
 * idea of the payload's shape.
 */
type Recorded = {
  claimedFlags: number | null;
  /** Every fault the client raised, in order, at the grain the client reports it. */
  readonly faults: string[];
  client: ModelClient;
};

function recording(client: ModelClient): Recorded {
  const recorded: Recorded = {
    claimedFlags: null,
    faults: [],
    client: {
      async complete(request: ModelRequest): Promise<ModelReply> {
        let reply: ModelReply;
        try {
          reply = await client.complete(request);
        } catch (error) {
          // The seams turn a fault into one of three states a reader has copy for, which
          // is right for a screen and one word short for an acceptance check. Caught here
          // and rethrown untouched, so the run can say which of the ten things went wrong
          // without either seam widening its surface.
          recorded.faults.push(`${request.purpose}: ${faultOf(error)}`);
          throw error;
        }
        if (request.purpose === "analysis") {
          const read = readModelAnalysis(reply.json);
          recorded.claimedFlags = read.ok ? read.payload.flags.length : null;
        }
        return reply;
      },
    },
  };
  return recorded;
}

// ── the run ───────────────────────────────────────────────────────────────────

/** The questions sidecar, as far as this script needs it. */
type QuestionsSidecar = {
  readonly document: string;
  readonly grounded: readonly { readonly question: string; readonly expectedSourceSentence: string }[];
  readonly ungrounded: readonly { readonly question: string; readonly why: string }[];
};

/** What went wrong with a call, in the two grains the client reports. */
function faultOf(error: unknown): string {
  if (error instanceof ModelCallError) return `${error.fault} (${error.failure}): ${error.message}`;
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function reportCompleteness(document: ExtractedDocument): void {
  heading("Completeness");
  say(`  Reading: ${document.completeness.level}`);
  say(`  Characters: ${document.characterCount.toLocaleString("en-US")}`);
  for (const signal of document.completeness.signals) {
    say(`  ${signal.fired ? "fired    " : "not fired"}  ${signal.code}`);
  }
}

/** True when everything the ticket asks of the analysis held. */
function reportAnalysis(
  document: ExtractedDocument,
  analysis: Analysis,
  claimed: number | null,
  faults: readonly string[],
): boolean {
  heading("Analysis");

  if (analysis.outcome === "failed") {
    say(`  No analysis. Reason the reader would meet: ${analysis.reason}`);
    for (const fault of faults) say(`  What went wrong: ${fault}`);
    const defects = defectsRecorded();
    if (defects.length > 0) {
      say("  Defects recorded on the way there:");
      for (const defect of defects) {
        say(
          `    ${defect.code}  clauseType=${defect.clauseType ?? "none"}  length=${defect.spanCharacterCount ?? "n/a"}`,
        );
      }
    }
    return false;
  }

  const { flags, defects, summary, checkedClauseTypes } = analysis.analysis;
  const dropped = defects.filter(
    (defect) => defect.code === "source-sentence-not-found" || defect.code === "source-sentence-missing",
  );
  const exitsDropped = defects.filter((defect) => defect.code === "exit-sentence-not-found");

  say(`  Flags the model claimed:            ${claimed ?? "unknown"}`);
  say(`  Flags that survived verification:   ${flags.length}`);
  say(`  Flags dropped, span not in document: ${dropped.length}`);
  if (claimed !== null) {
    const unaccounted = claimed - flags.length - dropped.length;
    if (unaccounted > 0) {
      say(`  Flags folded in as duplicates:      ${unaccounted}`);
    }
  }
  say(`  Exits dropped, span not in document: ${exitsDropped.length}`);
  say(`  Clause types checked:               ${checkedClauseTypes.length}`);

  heading("Summary");
  quoted(summary.text, "  ");

  const figures = defects.filter((defect) => defect.code === "summary-figure-not-found");
  if (figures.length > 0) {
    say();
    say(`  ${figures.length} figure(s) in the summary do not appear in the document. Recorded, summary still shows.`);
  }

  const ranking = rank({ flags, checkedClauseTypes });

  heading(`Flags, worst first (${ranking.flags.length})`);
  if (ranking.cleanDocument !== null) {
    say(`  No flag met the bar. ${ranking.cleanDocument.checkedClauseTypes.length} clause types were checked.`);
  }

  for (const ranked of ranking.flags) {
    const flag = ranked.flag;
    const band = SEVERITY_BAND_READING[flag.severity.band];
    say();
    say(`  ${ranked.rank}. ${clauseType(flag.clauseType).label}  [${flag.clauseType}]`);
    say(
      `     Severity: ${band.word} (baseline ${flag.severity.baselineBand}${
        flag.severity.movements.length === 0
          ? ""
          : `, moved by ${flag.severity.movements.map((movement) => movement.code).join(", ")}`
      })`,
    );
    say(`     Confidence: ${flag.confidence}`);
    say(`     Levers removed: ${flag.leverage.leversRemoved.join(", ") || "none"}`);
    say("     Consequence:");
    quoted(flag.consequence.fromTheDocument, "       ");
    if (flag.consequence.externalContext !== null) {
      say("     External context (its own source):");
      quoted(
        `${flag.consequence.externalContext.fact} [${flag.consequence.externalContext.source.title}]`,
        "       ",
      );
    }
    say(`     Source sentence (verified, at ${flag.sourceSentence.at.start}-${flag.sourceSentence.at.end}):`);
    quoted(`"${flag.sourceSentence.text}"`, "       ");
    if (flag.exit !== null) {
      say("     Exit the document grants:");
      quoted(flag.exit.text, "       ");
      quoted(`"${flag.exit.sourceSentence.text}"`, "       ");
    }
    if (flag.terms.windowToAct !== null) {
      const window = flag.terms.windowToAct;
      say(
        `     Window to act: ${window.days} days, ${window.runsAgainst}, stated in the document: ${window.statedInTheDocument}`,
      );
    }
  }

  // Belt as well as braces. The seam cannot return a flag whose sentence is not in the
  // document, and this run is the first one where a real model chose the sentences, so
  // the claim is checked here too rather than trusted.
  const unverifiable = ranking.flags.filter(
    (ranked) => !document.text.includes(ranked.flag.sourceSentence.text),
  );
  say();
  if (unverifiable.length === 0) {
    say(`  Re-checked against the stored text: all ${ranking.flags.length} source sentences appear verbatim.`);
  } else {
    say(`  BROKEN: ${unverifiable.length} source sentence(s) do not appear in the stored text.`);
  }

  // A drop is not a failure of the run. It is the rule working: the model claimed a
  // sentence the document does not contain and the flag never left the seam. The number
  // is the one the owner most wants to see, which is why it is printed above and not
  // counted against the run here. What would be a failure is a flag reaching a reader
  // with a sentence that cannot be shown, and that is what `unverifiable` counts.
  return unverifiable.length === 0 && ranking.flags.length > 0;
}

/** True when the grounded question was answered and the ungrounded one refused. */
async function reportQuestions(document: ExtractedDocument, model: ModelClient): Promise<boolean> {
  const sidecar = JSON.parse(fixture("questions.json")) as QuestionsSidecar;
  const grounded = sidecar.grounded[0];
  const ungrounded = sidecar.ungrounded[0];
  if (grounded === undefined || ungrounded === undefined) {
    say("  The questions sidecar carries no question to ask.");
    return false;
  }

  heading("The question box, one grounded question");
  say(`  Asked: ${grounded.question}`);
  const first = await answerQuestion({ document, question: grounded.question, model });
  let groundedHeld = false;
  switch (first.outcome) {
    case "answered":
      say("  Answered.");
      quoted(first.answer.text, "    ");
      say(`  Source sentence (verified, at ${first.answer.sourceSentence.at.start}-${first.answer.sourceSentence.at.end}):`);
      quoted(`"${first.answer.sourceSentence.text}"`, "    ");
      say(
        `  Matches the sentence the sidecar names: ${
          first.answer.sourceSentence.text === grounded.expectedSourceSentence
        }`,
      );
      groundedHeld = document.text.includes(first.answer.sourceSentence.text);
      if (!groundedHeld) say("  BROKEN: that sentence is not in the stored text.");
      break;
    case "refused":
      say(`  Refused: ${first.refusal}. The document does answer this one, so that is a miss.`);
      break;
    case "not-asked":
      say(`  Not asked: ${first.reason}`);
      break;
    case "failed":
      say(`  Failed. Reason the reader would meet: ${first.reason}`);
      break;
  }

  heading("The question box, one ungrounded question");
  say(`  Asked: ${ungrounded.question}`);
  say(`  Why the document cannot answer it: ${ungrounded.why}`);
  const second = await answerQuestion({ document, question: ungrounded.question, model });
  let ungroundedHeld = false;
  switch (second.outcome) {
    case "refused":
      say(`  Refused: ${second.refusal}. Correct.`);
      ungroundedHeld = true;
      break;
    case "answered":
      say("  BROKEN: answered a question the document does not answer.");
      quoted(second.answer.text, "    ");
      quoted(`"${second.answer.sourceSentence.text}"`, "    ");
      break;
    case "not-asked":
      say(`  Not asked: ${second.reason}`);
      break;
    case "failed":
      say(`  Failed. Reason the reader would meet: ${second.reason}`);
      break;
  }

  return groundedHeld && ungroundedHeld;
}

async function main(): Promise<number> {
  say("Redline smoke run: the adhesion contract, through the real model, once.");

  // Said plainly, and non-zero, rather than falling back to the stub. A smoke run that
  // passed without a model would be worthless as an acceptance check. The client is asked
  // which variable is missing rather than reading the environment here, so that one file
  // in the repo reads either value.
  const missing = notConfigured();
  if (missing !== null) {
    say();
    say(`${missing} is not set. Put it in .env.local and run this again.`);
    say("This script will not fall back to the test stub, because there would be nothing to check.");
    return 1;
  }

  const text = fixture("adhesion-contract.txt");
  const extraction = await extract({ kind: "pasted-text", text });
  if (extraction.outcome === "rejected") {
    say(`Extraction refused the fixture: ${extraction.reason}`);
    return 1;
  }
  const document = extraction.document;

  reportCompleteness(document);

  const recorder = recording(openRouterClient());

  let analysis: Analysis;
  const startedAt = Date.now();
  try {
    analysis = await analyse({ document, model: recorder.client });
  } catch (error) {
    heading("Analysis");
    say(`  The call threw: ${faultOf(error)}`);
    return 1;
  }
  const analysisSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  const analysisHeld = reportAnalysis(document, analysis, recorder.claimedFlags, recorder.faults);
  say();
  say(`  Analysis took ${analysisSeconds}s.`);

  const asking = recording(openRouterClient());
  let questionsHeld = false;
  try {
    questionsHeld = await reportQuestions(document, asking.client);
  } catch (error) {
    heading("The question box");
    say(`  The call threw: ${faultOf(error)}`);
  }

  heading("Every fault the client raised");
  const faults = [...recorder.faults, ...asking.faults];
  if (faults.length === 0) say("  None.");
  for (const fault of faults) say(`  ${fault}`);

  heading("Verdict on the run");
  say(`  Analysis: ${analysisHeld ? "held" : "did not hold"}`);
  say(`  Questions: ${questionsHeld ? "held" : "did not hold"}`);
  return analysisHeld && questionsHeld ? 0 : 1;
}

process.exitCode = await main();
