// Verifies the test fixtures under tests/fixtures.
//
// Run with: node scripts/verify-fixtures.mjs
//
// Checks, in order:
//   1. every sourceSentence, exit.sourceSentence and expectedSourceSentence in the
//      three sidecars is an exact substring of the document it names
//   2. every clause type slug is one of the seven, and every sidecar checks all seven
//   3. every expectedSeverityBand is critical, high or moderate, and every
//      confidence is a number between 0 and 1
//   4. planted clause ids run P-01 upward in document order
//   5. the adhesion contract carries the characters the fidelity tests need
//   6. the clean document trips none of the seven clause types on a keyword screen
//
// Exits non-zero on the first failing category, after printing every failure.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures");

const CLAUSE_TYPES = [
  "arbitration-and-class-action-waiver",
  "unilateral-modification",
  "non-compete",
  "auto-renewal",
  "limitation-of-liability",
  "indemnification",
  "fee-escalators-and-late-fees",
];
const BANDS = ["critical", "high", "moderate"];

const read = (name) => readFileSync(join(FIXTURES, name), "utf8");
const json = (name) => JSON.parse(read(name));

const failures = [];
const fail = (msg) => failures.push(msg);
const ok = (msg) => console.log(`  ok    ${msg}`);
const bad = (msg) => console.log(`  FAIL  ${msg}`);

const docs = new Map();
const doc = (name) => {
  if (!docs.has(name)) docs.set(name, read(name));
  return docs.get(name);
};

const show = (s) => (s.length > 64 ? `${s.slice(0, 61)}...` : s);

// ---------------------------------------------------------------- 1. verbatim
console.log("1. every sidecar sentence is a verbatim substring of its document");

const sentenceChecks = [];
for (const sidecarName of ["adhesion-contract.json", "clean-document.json"]) {
  const sidecar = json(sidecarName);
  for (const clause of sidecar.plantedClauses) {
    sentenceChecks.push([sidecarName, sidecar.document, `${clause.id} sourceSentence`, clause.sourceSentence]);
    if (clause.exit) {
      sentenceChecks.push([sidecarName, sidecar.document, `${clause.id} exit.sourceSentence`, clause.exit.sourceSentence]);
    }
  }
  sentenceChecks.push([sidecarName, sidecar.document, "title", sidecar.title]);
}
const questions = json("questions.json");
questions.grounded.forEach((q, i) => {
  sentenceChecks.push(["questions.json", questions.document, `grounded[${i}] expectedSourceSentence`, q.expectedSourceSentence]);
});

for (const [sidecarName, docName, label, sentence] of sentenceChecks) {
  if (typeof sentence !== "string" || sentence.length === 0) {
    fail(`${sidecarName} ${label}: missing or empty`);
    bad(`${sidecarName} ${label}: missing or empty`);
    continue;
  }
  const text = doc(docName);
  const count = text.split(sentence).length - 1;
  if (count === 1) {
    ok(`${sidecarName} ${label} -> ${docName}: "${show(sentence)}"`);
  } else if (count === 0) {
    fail(`${sidecarName} ${label}: not found in ${docName}`);
    bad(`${sidecarName} ${label}: NOT FOUND in ${docName}: "${show(sentence)}"`);
  } else {
    fail(`${sidecarName} ${label}: appears ${count} times in ${docName}`);
    bad(`${sidecarName} ${label}: appears ${count} times in ${docName}, so a citation is ambiguous`);
  }
}

// ---------------------------------------------------------------- 2. slugs
console.log("2. clause type slugs");
for (const sidecarName of ["adhesion-contract.json", "clean-document.json"]) {
  const sidecar = json(sidecarName);
  const checked = sidecar.checkedClauseTypes ?? [];
  const missing = CLAUSE_TYPES.filter((t) => !checked.includes(t));
  const extra = checked.filter((t) => !CLAUSE_TYPES.includes(t));
  if (missing.length === 0 && extra.length === 0) {
    ok(`${sidecarName} checkedClauseTypes lists all seven and nothing else`);
  } else {
    fail(`${sidecarName} checkedClauseTypes wrong`);
    bad(`${sidecarName} checkedClauseTypes missing [${missing}] extra [${extra}]`);
  }
  for (const clause of sidecar.plantedClauses) {
    if (CLAUSE_TYPES.includes(clause.clauseType)) {
      ok(`${sidecarName} ${clause.id} clauseType ${clause.clauseType}`);
    } else {
      fail(`${sidecarName} ${clause.id} unknown clauseType`);
      bad(`${sidecarName} ${clause.id} unknown clauseType ${clause.clauseType}`);
    }
  }
}

// ---------------------------------------------------------------- 3. bands
console.log("3. severity bands and confidence");
for (const sidecarName of ["adhesion-contract.json", "clean-document.json"]) {
  const sidecar = json(sidecarName);
  for (const clause of sidecar.plantedClauses) {
    if (BANDS.includes(clause.expectedSeverityBand)) {
      ok(`${sidecarName} ${clause.id} band ${clause.expectedSeverityBand}`);
    } else {
      fail(`${sidecarName} ${clause.id} bad band`);
      bad(`${sidecarName} ${clause.id} band ${clause.expectedSeverityBand} is not one of ${BANDS}`);
    }
    const c = clause.confidence;
    if (typeof c === "number" && c > 0 && c <= 1) {
      ok(`${sidecarName} ${clause.id} confidence ${c}`);
    } else {
      fail(`${sidecarName} ${clause.id} bad confidence`);
      bad(`${sidecarName} ${clause.id} confidence ${c} is not a number in (0, 1]`);
    }
  }
}

// ---------------------------------------------------------------- 4. ids in order
console.log("4. planted clause ids run upward in document order");
for (const sidecarName of ["adhesion-contract.json", "clean-document.json"]) {
  const sidecar = json(sidecarName);
  const text = doc(sidecar.document);
  let previous = -1;
  let expected = 1;
  let good = true;
  for (const clause of sidecar.plantedClauses) {
    const wantId = `P-${String(expected).padStart(2, "0")}`;
    if (clause.id !== wantId) {
      good = false;
      fail(`${sidecarName} expected id ${wantId}, found ${clause.id}`);
      bad(`${sidecarName} expected id ${wantId}, found ${clause.id}`);
    }
    const at = text.indexOf(clause.sourceSentence);
    if (at >= 0 && at < previous) {
      good = false;
      fail(`${sidecarName} ${clause.id} is out of document order`);
      bad(`${sidecarName} ${clause.id} is out of document order`);
    }
    previous = at;
    expected += 1;
  }
  if (good) ok(`${sidecarName} ${sidecar.plantedClauses.length} planted clauses, ids and order consistent`);
}

// ---------------------------------------------------------------- 5. characters
console.log("5. character fidelity in adhesion-contract.txt");
const adhesion = doc("adhesion-contract.txt");
const charChecks = [
  ["curly double open quote U+201C", /“/],
  ["curly double close quote U+201D", /”/],
  ["curly single open quote U+2018", /‘/],
  ["curly single close quote U+2019", /’/],
  ["typographic ligature U+FB01 or U+FB02", /[ﬁﬂ]/],
  ["non-breaking space U+00A0", / /],
  ["em dash U+2014", /—/],
  ["two or more spaces inside a sentence", /[a-z0-9%)][ ]{2,}[a-z]/],
  ["a line with trailing whitespace", /[^\s][ \t]+\n/],
  ["tab character", /\t/],
];
for (const [label, re] of charChecks) {
  if (re.test(adhesion)) ok(`adhesion-contract.txt contains ${label}`);
  else {
    fail(`adhesion-contract.txt missing ${label}`);
    bad(`adhesion-contract.txt missing ${label}`);
  }
}
for (const name of ["adhesion-contract.txt", "clean-document.txt"]) {
  const text = doc(name);
  if (text.includes("\r")) {
    fail(`${name} has a carriage return`);
    bad(`${name} has a carriage return, so it is not LF only`);
  } else ok(`${name} uses LF line endings only`);
  if (text.charCodeAt(0) === 0xfeff) {
    fail(`${name} starts with a byte-order mark`);
    bad(`${name} starts with a byte-order mark`);
  } else ok(`${name} has no byte-order mark`);
}

// ---------------------------------------------------------------- 6. clean screen
console.log("6. clean-document.txt trips none of the seven clause types");
const clean = doc("clean-document.txt").toLowerCase();
const screen = [
  ["arbitration-and-class-action-waiver", ["arbitrat", "class action", "class, collective", "waive any right", "jury"]],
  ["unilateral-modification", ["may amend", "at any time by posting", "sole discretion", "we may change", "amended version applies"]],
  ["non-compete", ["non-compete", "noncompete", "restrictive covenant", "will not teach", "shall not compete", "solicit"]],
  ["auto-renewal", ["renews automatically", "automatically renew", "automatic renewal", "renew for a further", "then-current rate", "unless you cancel"]],
  ["limitation-of-liability", ["limitation of liability", "not exceed", "not be liable", "is not liable", "consequential", "hold harmless", "at your own risk"]],
  ["indemnification", ["indemnif", "hold harmless", "defend and hold"]],
  ["fee-escalators-and-late-fees", ["late fee", "late charge", "escalat", "increase the fee", "consumer price index", "may adjust"]],
];
for (const [type, needles] of screen) {
  const hits = needles.filter((n) => clean.includes(n));
  if (hits.length === 0) ok(`clean-document.txt shows no sign of ${type}`);
  else {
    fail(`clean-document.txt may contain ${type}`);
    bad(`clean-document.txt may contain ${type}: matched [${hits}]`);
  }
}
const cleanSidecar = json("clean-document.json");
if (cleanSidecar.plantedClauses.length === 0) ok("clean-document.json has an empty plantedClauses list");
else {
  fail("clean-document.json has planted clauses");
  bad("clean-document.json has planted clauses");
}

// ---------------------------------------------------------------- summary
console.log("");
if (failures.length === 0) {
  console.log(`PASS  ${sentenceChecks.length} sentences verified verbatim, 0 failures`);
  process.exit(0);
}
console.log(`FAIL  ${failures.length} failures`);
for (const f of failures) console.log(`  - ${f}`);
process.exit(1);
