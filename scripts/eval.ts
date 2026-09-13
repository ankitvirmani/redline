/**
 * `npm run eval`: the labelled corpus through the real model, and the numbers
 * `PRD.md` section 4 was written to be measured by.
 *
 * Tier two of the two tiers in the spec. It is not part of `npm test`, it is not
 * imported by anything under `app/` or `src/`, and it costs money to run, so it runs
 * only when someone types the command.
 *
 * ## Two kinds of check, kept apart
 *
 * **Blocking.** Citation integrity, across every flag and every answer in the corpus.
 * Ranking, that arbitration outranks a merely unusual clause. An answer to a question
 * the document cannot answer. `PRD.md` calls the first pass/fail with no threshold, the
 * second a specified behaviour, and the third a defect of the same class as a missing
 * citation. Any one of them exits non-zero.
 *
 * **Informs.** Recall per clause type and per evidence group, precision at the top
 * band, the clean-document reading on a benign document, the refusal rate, and the rate
 * at which a flag was dropped for a sentence the document does not contain. Every one
 * of these is a measurement of a model over documents, the proposed figures in
 * `PRD.md` section 4 are uncalibrated, and the ticket says plainly not to gate on them.
 * They are printed with the counts behind them and they never change the exit code.
 *
 * ## What it does not do
 *
 * It does not touch a prompt, a seam or a threshold to move a number. It calls the same
 * four seams the route handlers call, through the same injected client interface, with
 * the real client behind a retry and a cache (`scripts/eval/calls.ts`). If a number
 * here is bad, the number is the finding.
 *
 * It prints no key and no model id, and writes neither to the run record. The only
 * thing it says about either variable is whether it is set.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { analyse, type Analysis, type Flag } from "@/src/analysis";
import { readModelAnalysis } from "@/src/analysis/schema";
import { SEVERITY_BAND_READING, clauseType, type ClauseTypeSlug } from "@/src/domain/clause-types";
import { extract, type ExtractedDocument } from "@/src/extraction";
import {
  ModelCallError,
  type ModelClient,
  type ModelReply,
  type ModelRequest,
} from "@/src/model/client";
import { notConfigured, openRouterClient } from "@/src/model/openrouter";
import { answerQuestion } from "@/src/qa";
import { rank } from "@/src/ranking";

import { evalClient, type CallLedger } from "./eval/calls";
import {
  CorpusError,
  inventory,
  loadCorpus,
  typographyIn,
  type Corpus,
  type CorpusDocument,
} from "./eval/corpus";
import {
  arbitrationOutranksTheMerelyUnusual,
  asPercentage,
  matchFlags,
  plantedKey,
  precisionAtTopBand,
  recallByClauseType,
  recallByEvidence,
  tallyQuestions,
  type PlantedClause,
  type QuestionOutcome,
  type RankedForCheck,
  type RankingCheck,
  type ReturnedFlag,
} from "./eval/metrics";

/** Where a run is written. Timestamped, so runs accumulate and none overwrites another. */
const RUNS_DIRECTORY = new URL("../eval-runs/", import.meta.url);

// ── printing ──────────────────────────────────────────────────────────────────

const lines: string[] = [];

/** Every line goes to the terminal and into the run record, so the two cannot differ. */
function say(line = ""): void {
  lines.push(line);
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

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

/** What went wrong with a call, in the two grains the client reports. */
function faultOf(error: unknown): string {
  if (error instanceof ModelCallError) return `${error.fault} (${error.failure})`;
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

// ── counting what the model claimed ───────────────────────────────────────────

/**
 * The client with a count of the flags the model claimed kept beside it.
 *
 * `analyse` returns the flags that survived verification and the defects raised getting
 * there, which is everything a reader needs and one number short of a drop rate: how
 * many flags the model claimed in the first place. Adding the drops to the survivors
 * misses the ones `verifiedFlags` folded together as duplicates, so the number is read
 * off the reply with the seam's own reader. `scripts/smoke.ts` does the same thing for
 * the same reason, and it observes the boundary rather than doing the boundary's job: it
 * reads the reply and decides nothing from it.
 */
function recording(client: ModelClient): {
  claimedFlags: number | null;
  readonly client: ModelClient;
} {
  const recorded: { claimedFlags: number | null; client: ModelClient } = {
    claimedFlags: null,
    client: {
      async complete(request: ModelRequest): Promise<ModelReply> {
        const reply = await client.complete(request);
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

// ── what one document produced ────────────────────────────────────────────────

type DocumentReading = {
  readonly id: string;
  readonly outcome: "read" | "no-analysis";
  readonly reason: string | null;
  readonly flagsClaimedByTheModel: number | null;
  readonly flagsVerified: number;
  readonly flagsDropped: number;
  readonly exitsDropped: number;
  readonly cleanDocument: boolean;
  readonly ranking: RankingCheck;
  /** Quotes that do not appear in the document. Any one of these blocks the run. */
  readonly quotesNotInTheDocument: readonly string[];
  readonly flags: readonly ReturnedFlag[];
  readonly summary: string | null;
};

async function readDocument(
  document: CorpusDocument,
  extracted: ExtractedDocument,
  model: ModelClient,
): Promise<DocumentReading> {
  const recorder = recording(model);
  const empty = {
    id: document.id,
    flagsClaimedByTheModel: null,
    flagsVerified: 0,
    flagsDropped: 0,
    exitsDropped: 0,
    cleanDocument: false,
    ranking: { outcome: "not-applicable", why: "there is no analysis" } as RankingCheck,
    quotesNotInTheDocument: [],
    flags: [],
    summary: null,
  };

  let analysis: Analysis;
  try {
    analysis = await analyse({ document: extracted, model: recorder.client });
  } catch (error) {
    return { ...empty, outcome: "no-analysis", reason: faultOf(error) };
  }
  if (analysis.outcome === "failed") {
    return { ...empty, outcome: "no-analysis", reason: analysis.reason };
  }

  const { flags, defects, summary, checkedClauseTypes } = analysis.analysis;
  const dropped = defects.filter(
    (defect) =>
      defect.code === "source-sentence-not-found" || defect.code === "source-sentence-missing",
  );
  const exitsDropped = defects.filter((defect) => defect.code === "exit-sentence-not-found");

  const ranking = rank({ flags, checkedClauseTypes });

  // Belt as well as braces. No flag can leave the analysis seam without a verified
  // sentence, and this is the run where a real model chose every sentence in the
  // corpus, so the claim is checked again here rather than trusted.
  const quotesNotInTheDocument: string[] = [];
  for (const ranked of ranking.flags) {
    const flag: Flag = ranked.flag;
    if (!document.text.includes(flag.sourceSentence.text)) {
      quotesNotInTheDocument.push(`${document.id} ${flag.code}: source sentence`);
    }
    if (flag.exit !== null && !document.text.includes(flag.exit.sourceSentence.text)) {
      quotesNotInTheDocument.push(`${document.id} ${flag.code}: exit sentence`);
    }
  }

  const returned: ReturnedFlag[] = ranking.flags.map((ranked) => ({
    documentId: document.id,
    code: ranked.flag.code,
    clauseType: ranked.flag.clauseType,
    at: ranked.flag.sourceSentence.at,
    band: ranked.flag.severity.band,
    sourceSentence: ranked.flag.sourceSentence.text,
  }));

  const forCheck: RankedForCheck[] = ranking.flags.map((ranked) => ({
    code: ranked.flag.code,
    clauseType: ranked.flag.clauseType,
    band: ranked.flag.severity.band,
    rank: ranked.rank,
  }));

  return {
    id: document.id,
    outcome: "read",
    reason: null,
    flagsClaimedByTheModel: recorder.claimedFlags,
    flagsVerified: flags.length,
    flagsDropped: dropped.length,
    exitsDropped: exitsDropped.length,
    cleanDocument: ranking.cleanDocument !== null,
    ranking: arbitrationOutranksTheMerelyUnusual(forCheck),
    quotesNotInTheDocument,
    flags: returned,
    summary: summary.text,
  };
}

// ── the question box ──────────────────────────────────────────────────────────

type QuestionResult = {
  readonly documentId: string;
  readonly kind: "grounded" | "ungrounded";
  readonly question: string;
  readonly outcome: QuestionOutcome;
  readonly detail: string;
  /** The sentence an answer cited, for the record and for the citation check. */
  readonly sourceSentence: string | null;
  /** Whether the cited sentence is the one the corpus names. Grounded questions only. */
  readonly citedTheExpectedSentence: boolean | null;
};

async function askQuestions(
  document: CorpusDocument,
  extracted: ExtractedDocument,
  model: ModelClient,
): Promise<readonly QuestionResult[]> {
  if (document.questions === null) return [];
  const results: QuestionResult[] = [];

  const ask = async (
    kind: "grounded" | "ungrounded",
    question: string,
    expected: string | null,
  ): Promise<void> => {
    let reading;
    try {
      reading = await answerQuestion({ document: extracted, question, model });
    } catch (error) {
      results.push({
        documentId: document.id,
        kind,
        question,
        outcome: "failed",
        detail: faultOf(error),
        sourceSentence: null,
        citedTheExpectedSentence: null,
      });
      return;
    }
    switch (reading.outcome) {
      case "answered":
        results.push({
          documentId: document.id,
          kind,
          question,
          outcome: "answered",
          detail: reading.answer.text,
          sourceSentence: reading.answer.sourceSentence.text,
          citedTheExpectedSentence:
            expected === null ? null : reading.answer.sourceSentence.text === expected,
        });
        return;
      case "refused":
        results.push({
          documentId: document.id,
          kind,
          question,
          outcome: "refused",
          detail: reading.refusal,
          sourceSentence: null,
          citedTheExpectedSentence: null,
        });
        return;
      case "not-asked":
        results.push({
          documentId: document.id,
          kind,
          question,
          outcome: "not-asked",
          detail: reading.reason,
          sourceSentence: null,
          citedTheExpectedSentence: null,
        });
        return;
      case "failed":
        results.push({
          documentId: document.id,
          kind,
          question,
          outcome: "failed",
          detail: reading.reason,
          sourceSentence: null,
          citedTheExpectedSentence: null,
        });
        return;
    }
  };

  for (const grounded of document.questions.grounded) {
    await ask("grounded", grounded.question, grounded.expectedSourceSentence);
  }
  for (const ungrounded of document.questions.ungrounded) {
    await ask("ungrounded", ungrounded.question, null);
  }
  return results;
}

// ── the run ───────────────────────────────────────────────────────────────────

function reportTheCorpus(corpus: Corpus): void {
  heading(`The corpus: ${corpus.name} v${corpus.version}`);
  say(`  ${corpus.whatThisIs}`);
  say();
  say(`  ${pad("document", 30)}${pad("characters", 12)}${pad("planted", 9)}provenance`);
  for (const document of corpus.documents) {
    say(
      `  ${pad(document.id, 30)}${pad(String(document.characterCount), 12)}${pad(
        document.benign ? "benign" : String(document.planted.length),
        9,
      )}${document.provenance}`,
    );
  }
  say();
  const counts = inventory(corpus);
  say("  Instances per clause type, which is what every recall figure divides by:");
  for (const [slug, count] of Object.entries(counts)) {
    const thin = count < 5 ? "  too thin for the figure to mean much" : "";
    say(`    ${pad(slug, 38)}${pad(String(count), 4)}${clauseType(slug as ClauseTypeSlug).evidence}${thin}`);
  }
}

function reportWhatBlocks(): void {
  heading("What blocks the run, and what only informs it");
  say("  Blocking   Citation integrity: every flag and every answer shows a sentence that is in");
  say("             the document, character for character. PRD.md section 4 makes this pass or");
  say("             fail with no threshold.");
  say("  Blocking   Ranking: arbitration outranks a merely unusual clause, in every reading that");
  say("             has both. A specified behaviour, so a failure is a defect.");
  say("  Blocking   An answer to a question the document cannot answer. PRD.md puts one in the");
  say("             same class as a missing citation. The count blocks; the percentage informs.");
  say("  Informs    Recall per clause type and per evidence group.");
  say("  Informs    Precision at the top severity band, which is a proxy here, not the figure.");
  say("  Informs    The clean-document reading on a benign document.");
  say("  Informs    The rate at which a flag was dropped for a sentence not in the document.");
  say("  Informs    Grounded questions answered, and which sentence was cited.");
  say();
  say("  The proposed thresholds in PRD.md section 4 are uncalibrated and nothing here is");
  say("  measured against them. Do not read a number below as a pass or a failure.");
}

async function main(): Promise<number> {
  const startedAt = new Date();
  say(`Redline eval run, started ${startedAt.toISOString()}.`);

  let corpus: Corpus;
  try {
    corpus = loadCorpus();
  } catch (error) {
    if (error instanceof CorpusError) {
      say();
      say("The corpus did not load, so there is nothing to measure.");
      for (const problem of error.problems) say(`  ${problem}`);
      return 1;
    }
    throw error;
  }

  const missing = notConfigured();
  if (missing !== null) {
    say();
    say(`${missing} is not set. Put it in .env.local and run this again.`);
    say("This run will not fall back to the test stub, because there would be nothing to measure.");
    return 1;
  }
  say("A model id was read from OPENROUTER_MODEL. It is not printed and not recorded.");

  const useCache = !process.argv.includes("--fresh");
  say(
    useCache
      ? "Replies already on disk from an earlier pass are reused, so an interrupted pass resumes. Pass --fresh to call for every one."
      : "Called fresh: nothing on disk is reused.",
  );

  reportWhatBlocks();
  reportTheCorpus(corpus);

  const { client, ledger } = evalClient(openRouterClient(), {
    useCache,
    onWait: (attempt, ms, fault) => {
      say(`    waiting ${(ms / 1000).toFixed(0)}s after ${fault} on attempt ${attempt}`);
    },
  });

  const readings: DocumentReading[] = [];
  const questionResults: QuestionResult[] = [];
  const planted: PlantedClause[] = [];
  const flags: ReturnedFlag[] = [];
  const extractionRefusals: string[] = [];

  heading("Reading the corpus");
  for (const document of corpus.documents) {
    const extraction = await extract({ kind: "pasted-text", text: document.text });
    if (extraction.outcome === "rejected") {
      extractionRefusals.push(`${document.id}: ${extraction.reason}`);
      say(`  ${pad(document.id, 30)}extraction refused it: ${extraction.reason}`);
      continue;
    }

    for (const clause of document.planted) {
      planted.push({
        documentId: document.id,
        id: clause.id,
        clauseType: clause.clauseType,
        at: clause.at,
        expectedSeverityBand: clause.expectedSeverityBand,
      });
    }

    const reading = await readDocument(document, extraction.document, client);
    readings.push(reading);
    flags.push(...reading.flags);
    say(
      `  ${pad(document.id, 30)}${
        reading.outcome === "read"
          ? `${reading.flagsVerified} flags, ${reading.flagsDropped} dropped, completeness ${extraction.document.completeness.level}`
          : `no analysis: ${reading.reason}`
      }`,
    );

    if (document.questions !== null) {
      const asked = await askQuestions(document, extraction.document, client);
      questionResults.push(...asked);
      const refused = asked.filter((result) => result.outcome === "refused").length;
      say(`  ${pad("", 30)}${asked.length} questions asked, ${refused} refused`);
    }
  }

  const matches = matchFlags(planted, flags);

  // ── recall ──────────────────────────────────────────────────────────────────

  heading("Recall per clause type");
  say("  The matching rule, which is the measurement:");
  say("    strict   the flag names the planted clause's type and its verified sentence overlaps");
  say("             the planted sentence in the document. This is the primary figure.");
  say("    by type  the document produced any flag of that type, wherever it was cited. Looser,");
  say("             and the gap between the two is where the model found the right category and");
  say("             the wrong clause.");
  say("    The third column counts planted clauses whose sentence a flag did quote, under some");
  say("    other type. Those flags read the right words and named the wrong thing.");
  say();
  say(
    `  ${pad("clause type", 38)}${pad("evidence", 20)}${pad("strict", 20)}${pad("by type", 20)}wrong type`,
  );
  const perType = recallByClauseType(planted, flags, matches);
  for (const row of perType) {
    say(
      `  ${pad(row.clauseType, 38)}${pad(row.evidence, 20)}${pad(
        `${row.strict.found}/${row.strict.instances} ${asPercentage(row.strict.rate)}`,
        20,
      )}${pad(`${row.byType.found}/${row.byType.instances} ${asPercentage(row.byType.rate)}`, 20)}${
        row.sentenceCitedUnderAnotherType
      }`,
    );
  }

  heading("Recall by evidence group");
  say("  PRD.md section 4 proposes 95 percent on the four regulator-evidenced types and 80 on");
  say("  the other three. Both figures are uncalibrated and neither is applied here.");
  say();
  const perEvidence = recallByEvidence(planted, flags, matches);
  for (const row of perEvidence) {
    say(`  ${row.evidence}`);
    say(`    types:    ${row.clauseTypes.join(", ")}`);
    say(`    strict:   ${row.strict.found}/${row.strict.instances}  ${asPercentage(row.strict.rate)}`);
    say(`    by type:  ${row.byType.found}/${row.byType.instances}  ${asPercentage(row.byType.rate)}`);
  }

  // ── typography ──────────────────────────────────────────────────────────────

  heading("Recall split by the characters in the sentence");
  say("  Ticket 10's run dropped the same flag on every attempt, on a sentence carrying an em");
  say("  dash, a curly apostrophe and a non-breaking space: the model retyped those characters");
  say("  rather than copying them, so the span did not verify and the flag never left the seam.");
  say("  This split says how much of the drop rate those characters account for.");
  say();
  const atRisk = corpus.documents.flatMap((document) =>
    document.planted
      .filter((clause) => typographyIn(clause.sourceSentence).length > 0)
      .map((clause) => ({ key: `${document.id}#${clause.id}`, classes: typographyIn(clause.sourceSentence) })),
  );
  const atRiskKeys = new Set(atRisk.map((entry) => entry.key));
  const plainKeys = planted.map(plantedKey).filter((key) => !atRiskKeys.has(key));
  const atRiskFound = [...atRiskKeys].filter((key) => matches.strict.has(key)).length;
  const plainFound = plainKeys.filter((key) => matches.strict.has(key)).length;
  say(
    `  sentences carrying at-risk characters:  ${atRiskFound}/${atRiskKeys.size}  ${asPercentage(
      atRiskKeys.size === 0 ? null : atRiskFound / atRiskKeys.size,
    )}`,
  );
  say(
    `  sentences carrying none:                ${plainFound}/${plainKeys.length}  ${asPercentage(
      plainKeys.length === 0 ? null : plainFound / plainKeys.length,
    )}`,
  );
  const missedAtRisk = atRisk.filter((entry) => !matches.strict.has(entry.key));
  if (missedAtRisk.length > 0) {
    say("  Missed, with the characters each sentence carries:");
    for (const entry of missedAtRisk) say(`    ${pad(entry.key, 40)}${entry.classes.join(", ")}`);
  }

  // ── precision ───────────────────────────────────────────────────────────────

  const precision = precisionAtTopBand(planted, flags, "critical", matches);
  heading(`Precision at the top severity band (${SEVERITY_BAND_READING.critical.word})`);
  say("  PRD.md section 4 asks what fraction of top-band flags survive review by a person");
  say("  reading the source sentence. Nobody is reading in a run, so this is the proxy the");
  say("  ticket names and not the measurement. The flags are printed below so the owner can do");
  say("  the real review by reading them.");
  say();
  say(`  Flags at the top band:                            ${precision.topBandFlags}`);
  say(`  Of those, found a planted clause banded critical:  ${precision.foundACriticalPlantedClause}`);
  say(`  Found a planted clause the corpus banded lower:    ${precision.foundALowerBandedPlantedClause}`);
  say(`  Found nothing planted at all:                      ${precision.foundNothingPlanted}`);
  say(`  Proxy precision:                                   ${asPercentage(precision.precision)}`);
  say(`  Against any planted clause, at either band:        ${asPercentage(precision.precisionAgainstAnyPlantedClause)}`);
  say();
  say(`  Flags that found no planted clause anywhere in the corpus: ${matches.unmatchedFlags.length}`);
  say(`  Flags beyond the first to find the same planted clause:    ${matches.duplicateFlags}`);

  heading("Every top-band flag, with its source sentence");
  say("  Read these. Precision at high severity needs a person reading the sentence. This list is");
  say("  what they read.");
  const topBand = flags.filter((flag) => flag.band === "critical");
  if (topBand.length === 0) say("  None.");
  for (const flag of topBand) {
    const matched = matches.strictMatchOf.get(`${flag.documentId}#${flag.code}`);
    say();
    say(`  ${flag.documentId} ${flag.code}  ${clauseType(flag.clauseType).label}`);
    say(`    found: ${matched ?? "no planted clause of this type at this sentence"}`);
    quoted(`"${flag.sourceSentence}"`, "    ");
  }

  // ── clean documents ─────────────────────────────────────────────────────────

  heading("Clean documents");
  say("  PRD.md section 4: against a benign corpus the system reports a clean document with the");
  say("  list of what was checked, and no flag at the top band. A tool that manufactured a");
  say("  finding to look useful has failed this even though nothing it said was false.");
  say();
  for (const document of corpus.documents.filter((entry) => entry.benign)) {
    const reading = readings.find((entry) => entry.id === document.id);
    if (reading === undefined) {
      say(`  ${pad(document.id, 30)}not read`);
      continue;
    }
    const topBandHere = reading.flags.filter((flag) => flag.band === "critical").length;
    say(
      `  ${pad(document.id, 30)}${reading.flagsVerified} flags, ${topBandHere} at the top band, clean reading: ${reading.cleanDocument}`,
    );
    for (const flag of reading.flags) {
      say(`    ${clauseType(flag.clauseType).label} at ${flag.band}`);
      quoted(`"${flag.sourceSentence}"`, "      ");
    }
  }

  // ── ranking ─────────────────────────────────────────────────────────────────

  heading("Ranking: arbitration outranks a merely unusual clause");
  let rankingBroken = 0;
  for (const reading of readings) {
    switch (reading.ranking.outcome) {
      case "held":
        say(
          `  ${pad(reading.id, 30)}held. Arbitration is rank ${reading.ranking.arbitrationRank}, above ${reading.ranking.comparedWith} flag(s) below the top band.`,
        );
        break;
      case "not-applicable":
        say(`  ${pad(reading.id, 30)}nothing to compare: ${reading.ranking.why}`);
        break;
      case "broken":
        rankingBroken += 1;
        say(`  ${pad(reading.id, 30)}BROKEN. Arbitration is rank ${reading.ranking.arbitrationRank}, below:`);
        for (const above of reading.ranking.outrankedBy) {
          say(`    rank ${above.rank}  ${above.code}  ${above.band}`);
        }
        break;
    }
  }

  // ── questions ───────────────────────────────────────────────────────────────

  const grounded = questionResults.filter((result) => result.kind === "grounded");
  const ungrounded = questionResults.filter((result) => result.kind === "ungrounded");
  const groundedTally = tallyQuestions(
    grounded.map((result) => result.outcome),
    "answers",
  );
  const ungroundedTally = tallyQuestions(
    ungrounded.map((result) => result.outcome),
    "refusals",
  );
  const answeredUngrounded = ungrounded.filter((result) => result.outcome === "answered");

  heading("The question box");
  say("  Both halves are counted. A product that refused every question would score 100 percent");
  say("  refusal and be worth nothing, so the refusal figure means nothing without the answered");
  say("  figure beside it.");
  say();
  say(
    `  Questions the document answers:      ${groundedTally.answered}/${groundedTally.asked} answered  ${asPercentage(groundedTally.rate)}, ${groundedTally.refused} refused, ${groundedTally.failed} failed`,
  );
  const citedExpected = grounded.filter((result) => result.citedTheExpectedSentence === true).length;
  say(
    `  Of those answers, cited the sentence the corpus names: ${citedExpected}/${groundedTally.answered}`,
  );
  say("    A different sentence is not automatically a wrong answer. The ticket 10 run found the");
  say("    model citing a sentence that answered the question better than the one the sidecar");
  say("    names, which is why this is reported and why recall is not matched on it.");
  say();
  say(
    `  Questions the document cannot answer: ${ungroundedTally.refused}/${ungroundedTally.asked} refused  ${asPercentage(ungroundedTally.rate)}, ${ungroundedTally.answered} answered, ${ungroundedTally.failed} failed`,
  );

  if (grounded.some((result) => result.outcome !== "answered")) {
    say();
    say("  Questions the document answers and the run did not answer:");
    for (const result of grounded.filter((entry) => entry.outcome !== "answered")) {
      say(`    ${result.documentId}  ${result.outcome} (${result.detail})`);
      quoted(result.question, "      ");
    }
  }

  if (answeredUngrounded.length > 0) {
    say();
    say("  BLOCKING. These questions have no answer in the document and were answered anyway.");
    say("  Read each one: the corpus is the thing making the ungrounded claim, so a label worth");
    say("  arguing with is a corpus fix rather than a product fix.");
    for (const result of answeredUngrounded) {
      say();
      say(`    ${result.documentId}`);
      quoted(result.question, "      ");
      quoted(result.detail, "      ");
      quoted(`"${result.sourceSentence ?? ""}"`, "      ");
    }
  }

  // ── citation integrity ──────────────────────────────────────────────────────

  const citationFailures: string[] = readings.flatMap((reading) => [
    ...reading.quotesNotInTheDocument,
  ]);
  for (const result of questionResults) {
    if (result.sourceSentence === null) continue;
    const document = corpus.documents.find((entry) => entry.id === result.documentId);
    if (document !== undefined && !document.text.includes(result.sourceSentence)) {
      citationFailures.push(`${result.documentId}: an answer's source sentence`);
    }
  }

  const claimed = readings.reduce((at, reading) => at + (reading.flagsClaimedByTheModel ?? 0), 0);
  const droppedTotal = readings.reduce((at, reading) => at + reading.flagsDropped, 0);

  heading("Citation integrity");
  say("  Every quote a reader would see, held against the document it came from.");
  say();
  say(`  Flags the model claimed across the corpus:        ${claimed}`);
  say(`  Flags that survived verification:                 ${flags.length}`);
  say(`  Flags dropped, the span is not in the document:   ${droppedTotal}`);
  say(
    `  Drop rate:                                        ${asPercentage(claimed === 0 ? null : droppedTotal / claimed)}`,
  );
  say(`  Exits dropped, the span is not in the document:   ${readings.reduce((at, reading) => at + reading.exitsDropped, 0)}`);
  say();
  say("  A drop is the rule working, not a failure of the run: the model named a sentence the");
  say("  document does not contain and the flag never left the seam. What would be a failure is");
  say("  a quote reaching a reader that cannot be shown, which is the count below.");
  say();
  if (citationFailures.length === 0) {
    say(`  Quotes that do not appear in their document: 0. Checked ${flags.length} flags and every answer.`);
  } else {
    say(`  BLOCKING. ${citationFailures.length} quote(s) do not appear in their document:`);
    for (const failure of citationFailures) say(`    ${failure}`);
  }

  // ── what a pass cost ────────────────────────────────────────────────────────

  heading("What this pass cost");
  say(`  Calls the pass asked for:        ${ledger.calls}`);
  say(`  Answered from disk:              ${ledger.fromCache}`);
  say(`  Attempts made over the wire:     ${ledger.attempts}`);
  say(`  Calls that ran out of attempts:  ${ledger.gaveUp}`);
  const faults = Object.entries(ledger.faults);
  if (faults.length === 0) {
    say("  Faults:                          none");
  } else {
    say("  Faults, by what went wrong:");
    for (const [fault, count] of faults) say(`    ${pad(fault, 24)}${count}`);
  }

  // ── the verdict ─────────────────────────────────────────────────────────────

  const blocking: string[] = [];
  if (extractionRefusals.length > 0) {
    blocking.push(`extraction refused ${extractionRefusals.length} corpus document(s)`);
  }
  if (citationFailures.length > 0) {
    blocking.push(`${citationFailures.length} quote(s) do not appear in their document`);
  }
  if (rankingBroken > 0) {
    blocking.push(`arbitration was outranked by a lower-banded flag in ${rankingBroken} reading(s)`);
  }
  if (answeredUngrounded.length > 0) {
    blocking.push(`${answeredUngrounded.length} question(s) the document cannot answer were answered`);
  }
  const noAnalysis = readings.filter((reading) => reading.outcome === "no-analysis");
  if (noAnalysis.length > 0) {
    blocking.push(`${noAnalysis.length} document(s) produced no analysis, so they were not measured`);
  }

  heading("Verdict");
  if (blocking.length === 0) {
    say("  Every blocking check held.");
  } else {
    for (const problem of blocking) say(`  BLOCKED: ${problem}`);
  }
  say();
  say("  The numbers above are measurements. None of them decides this verdict, and the");
  say("  proposed figures in PRD.md section 4 still need calibrating against a real corpus.");

  writeTheRecord({
    startedAt,
    corpus,
    readings,
    questionResults,
    perType,
    perEvidence,
    precision,
    ledger,
    blocking,
    matches: {
      unmatchedFlags: matches.unmatchedFlags.length,
      duplicateFlags: matches.duplicateFlags,
    },
    topBand: topBand.map((flag) => ({ ...flag })),
    groundedTally,
    ungroundedTally,
  });

  return blocking.length === 0 ? 0 : 1;
}

// ── the record ────────────────────────────────────────────────────────────────

/**
 * Writes the run where runs accumulate.
 *
 * Two files per run, both named for the moment it started, so a second pass after a
 * prompt change sits beside the first rather than on top of it. The `.txt` is exactly
 * what the terminal showed. The `.json` is the same numbers in a shape something can
 * read later, when the owner calibrates the proposed thresholds against a handful of
 * passes.
 *
 * Neither file carries the model id. `PRD.md`'s model comes from an environment
 * variable, writing it into a committed file would put it in source, and the owner knows
 * what they set. The record says a model was read from the variable and stops there.
 */
function writeTheRecord(run: {
  startedAt: Date;
  corpus: Corpus;
  readings: readonly DocumentReading[];
  questionResults: readonly QuestionResult[];
  perType: ReturnType<typeof recallByClauseType>;
  perEvidence: ReturnType<typeof recallByEvidence>;
  precision: ReturnType<typeof precisionAtTopBand>;
  ledger: CallLedger;
  blocking: readonly string[];
  matches: { unmatchedFlags: number; duplicateFlags: number };
  topBand: readonly ReturnedFlag[];
  groundedTally: ReturnType<typeof tallyQuestions>;
  ungroundedTally: ReturnType<typeof tallyQuestions>;
}): void {
  mkdirSync(fileURLToPath(RUNS_DIRECTORY), { recursive: true });
  const stamp = run.startedAt.toISOString().replace(/[:.]/gu, "-");

  const record = {
    startedAt: run.startedAt.toISOString(),
    modelIdSource: "read from OPENROUTER_MODEL at call time, not recorded",
    corpus: {
      name: run.corpus.name,
      version: run.corpus.version,
      whatThisIs: run.corpus.whatThisIs,
      documents: run.corpus.documents.map((document) => ({
        id: document.id,
        characterCount: document.characterCount,
        provenance: document.provenance,
        benign: document.benign,
        plantedClauses: document.planted.length,
      })),
      inventory: inventory(run.corpus),
    },
    blocking: run.blocking,
    recallPerClauseType: run.perType,
    recallByEvidence: run.perEvidence,
    precisionAtTopBand: run.precision,
    topBandFlags: run.topBand,
    unmatchedFlags: run.matches.unmatchedFlags,
    duplicateFlags: run.matches.duplicateFlags,
    documents: run.readings.map((reading) => ({
      id: reading.id,
      outcome: reading.outcome,
      reason: reading.reason,
      flagsClaimedByTheModel: reading.flagsClaimedByTheModel,
      flagsVerified: reading.flagsVerified,
      flagsDropped: reading.flagsDropped,
      exitsDropped: reading.exitsDropped,
      cleanDocument: reading.cleanDocument,
      ranking: reading.ranking,
      quotesNotInTheDocument: reading.quotesNotInTheDocument,
      summary: reading.summary,
      flags: reading.flags,
    })),
    questions: {
      grounded: run.groundedTally,
      ungrounded: run.ungroundedTally,
      results: run.questionResults,
    },
    calls: {
      asked: run.ledger.calls,
      fromCache: run.ledger.fromCache,
      attempts: run.ledger.attempts,
      gaveUp: run.ledger.gaveUp,
      faults: run.ledger.faults,
    },
  };

  const json = fileURLToPath(new URL(`${stamp}.json`, RUNS_DIRECTORY));
  const text = fileURLToPath(new URL(`${stamp}.txt`, RUNS_DIRECTORY));
  writeFileSync(json, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  say();
  say(`  Recorded at eval-runs/${stamp}.json and eval-runs/${stamp}.txt`);
  // Written last, so the transcript on disk is the whole transcript including this line.
  writeFileSync(text, `${lines.join("\n")}\n`, "utf8");
}

process.exitCode = await main();
