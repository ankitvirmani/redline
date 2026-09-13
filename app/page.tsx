// The landing page, at the root. The paste box it hands the reader to is at /analyse.
//
// This is the one surface whose job is persuasion rather than analysis, so it is the
// easiest place in the product to breach the rule the rest of it is built on. Two
// things keep it honest, and both are checked by `tests/landing.test.ts`.
//
// The first is that every sentence traces to an entry in the landing-page claims list
// in `PRODUCT.md`. That list is the authority here, not taste: it enumerates the
// mechanisms the product performs, the external facts and their citations, and what may
// never be said. No accuracy figure, no reader count, no testimonial, no comparative
// quality claim, no price, no verdict on whether to sign.
//
// The second is that the fold shows real rendered output. The document is the fixture
// the deterministic suite reads, the flags beside it are what the four seams returned
// when it went through them against the real model, and every sentence quoted from the
// document is a verbatim slice of `tests/fixtures/adhesion-contract.txt`. That is this
// page's version of ADR 0001: a mockup of output the product does not produce would be
// the marketing equivalent of a flag that cannot show its source sentence. The recording
// lives in `components/landing-demonstration.ts`, which says where it came from.
//
// The page touches no seam (spec.md): no model call, no storage, no auth, no analysis
// state, and no import that reaches any of them. It renders whole on the server, and the
// one script on it draws the keyline between a flag and its sentence and plays the load
// snap. Turn JavaScript off and the resting state is already the right one.
//
// The design is recorded in `DESIGN.md` from `landing/index.html`, which stays in the
// repository as the source of record. The fold's refusal of a feature-card row, a metric
// strip and a soft-shadowed screenshot is load-bearing: Redline has no metrics and will
// not borrow the shape of proof.

import LandingRuntime from "@/components/LandingRuntime";
import {
  DEMONSTRATION_FLAGS,
  DEMONSTRATION_QUESTIONS,
  DOCUMENT_EXTRACTS,
  DOCUMENT_TITLE,
} from "@/components/landing-demonstration";

import "./landing.css";

/** A flag's code, held on one line. The hyphen is U+2011, which does not break. */
function unbroken(code: string): string {
  return code.replace("-", "‑");
}

export default function LandingPage() {
  return (
    <>
      <svg className="sprite" aria-hidden="true" focusable="false">
        <symbol id="arrow" viewBox="0 0 24 24"><path d="M4 12h14m0 0-5.5-5.5M18 12l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" /></symbol>
        <symbol id="bracket" viewBox="0 0 8 40"><path d="M7 1H1v38h6" fill="none" stroke="currentColor" strokeWidth="2" /></symbol>
      </svg>

      <a className="skip" href="#main">Skip to the demonstration</a>

      <div className="shell">

        {/* ── rail ───────────────────────────────────────────────── */}
        <header className="rail">
          <div className="rail__top">
            <a className="mark" href="#main" aria-label="Redline, home">
              <span className="mark__box" aria-hidden="true">R</span>
              <span className="mark__word">REDLINE</span>
            </a>

            <p className="rail__lede">A document you cannot negotiate, read back to you. Every flag quotes the sentence it came from.</p>

            <div className="rail__actions">
              <a className="btn btn--primary" href="/analyse">
                <span>Paste a document</span>
                <svg className="btn__arrow" aria-hidden="true"><use href="#arrow" /></svg>
              </a>
            </div>
          </div>

          <div className="rail__block">
            <h2 className="rail__label">What it checks for</h2>
            <ul className="rail-checks">
              <li>Arbitration and class-action waivers</li>
              <li>Unilateral modification</li>
              <li>Non-compete and restrictive covenants</li>
              <li>Auto-renewal and negative-option billing</li>
              <li>Limitation of liability</li>
              <li>Indemnification</li>
              <li>Fee escalators and late fees</li>
            </ul>
            <p className="rail__clean">When none of them meets the bar, Redline says the document is clean and shows you this list. An empty screen and a failed reading look identical.</p>
            <p className="rail__note">Redline describes documents. It does not give legal advice, and it never tells you whether to sign.</p>
          </div>
        </header>

        {/* ── main ───────────────────────────────────────────────── */}
        <main className="main" id="main">

          {/* viewport one: the demonstration, which is one real reading */}
          <section className="demo" aria-labelledby="demo-h">
            <div className="demo__head">
              <div className="chips" aria-hidden="true"><span className="chip chip--cyan"></span><span className="chip chip--magenta"></span><span className="chip chip--yellow"></span><span className="chip chip--green"></span><span className="chip chip--ink chip--sm"></span></div>
              <h1 id="demo-h" className="display">
                <span className="display__line">Eight sentences in</span>
                <span className="display__line"><span className="hl hl--magenta">this contract</span></span>
                <span className="display__line">cost you something.</span>
              </h1>
              <p className="demo__tag"><span className="demo__tag-chip">Example document</span> Written for this page, so it is nobody&apos;s real contract. Redline did read it, and the flags beside it are what came back.</p>
            </div>

            <div className="stage" id="stage">
              <svg className="stage__wires" id="wires" aria-hidden="true" focusable="false"></svg>

              {/* the document: three of its fourteen sections, quoted as they stand */}
              <article className="doc" aria-label="Example document">
                <h2 className="doc__title">{DOCUMENT_TITLE}</h2>

                {DOCUMENT_EXTRACTS.map((extract) => (
                  <p className="doc__p" key={extract.slot}>
                    <span className="doc__n">{extract.section}</span>{" "}
                    {extract.before}
                    <mark
                      className="src"
                      id={`src-${extract.slot}`}
                      data-flag={extract.slot}
                      data-code={DEMONSTRATION_FLAGS.find((flag) => flag.slot === extract.slot)?.code}
                      tabIndex={-1}
                    >
                      {extract.marked}
                    </mark>
                    {extract.after}
                  </p>
                ))}
              </article>

              {/* the flags */}
              <div className="flags" role="list" aria-label="Flags found in the example document">
                <p className="flags__lede">The three worst of the eight flags, ranked by what they take away. Select one to see the sentence it came from.</p>

                {DEMONSTRATION_FLAGS.map((flag, index) => (
                  <article
                    className={`flag flag--${flag.ink}${index === 0 ? " is-open" : ""}`}
                    role="listitem"
                    data-flag={flag.slot}
                    aria-describedby={`src-${flag.slot}`}
                    key={flag.code}
                  >
                    <button className="flag__bar" type="button" aria-expanded={index === 0}>
                      <span className="flag__rank">{flag.rank}</span>
                      <span className="flag__sev">{flag.severityWord}</span>
                      <span className="flag__type">{flag.clauseTypeLabel}</span>
                      <svg className="flag__arrow" aria-hidden="true"><use href="#arrow" /></svg>
                    </button>
                    <div className="flag__body">
                      <p className="flag__consequence">{flag.consequence}</p>
                      {flag.exit === null ? null : (
                        <p className="flag__exit"><span className="flag__k">The way out</span>{flag.exit.text}</p>
                      )}
                      {flag.external === null ? null : (
                        <p className="flag__ext">
                          <span className="flag__k flag__k--ext">Outside this document</span>
                          {flag.external.fact}{" "}
                          <cite><a href={flag.external.source.url} rel="noopener">{flag.external.source.title}</a></cite>
                        </p>
                      )}
                      <p className="flag__conf">
                        <span className="flag__k">Confidence</span>
                        Redline is {Math.round(flag.confidence * 100)}% sure it read this clause for what it is. That is a different question from what it costs you.
                      </p>
                      <p className="flag__code">{unbroken(flag.code)}</p>
                    </div>
                  </article>
                ))}

                <p className="flags__note">The reading returned nine flags and kept eight. The ninth quoted the liability cap in Section 6 but retyped the sentence instead of copying it, so Redline dropped the flag rather than show you a quote the document does not contain.</p>
                <p className="flags__note">Colour tells one flag from another. Severity is the word, and the order is the ranking.</p>
              </div>
            </div>
          </section>

          {/* anatomy */}
          <section className="anatomy" id="anatomy" aria-labelledby="anatomy-h">
            <div className="chips chips--anatomy" aria-hidden="true"><span className="chip chip--yellow"></span><span className="chip chip--cyan"></span><span className="chip chip--ink"></span><span className="chip chip--magenta"></span></div>
            <h2 id="anatomy-h" className="section-h section-h--struck">What a flag carries<span className="struck" aria-hidden="true"></span></h2>
            <p className="section-sub">Five things, and the first one is the reason you can trust the other four.</p>

            <ol className="parts">
              <li className="part part--magenta">
                <div className="part__text"><h3 className="part__h">The source sentence</h3><p>The exact words from your document, quoted whole. Redline checks the quote against your text in code before it reaches the screen, so it drops a flag it cannot quote instead of showing you one.</p></div>
              </li>
              <li className="part part--cyan">
                <div className="part__text"><h3 className="part__h">The consequence</h3><p>What the clause does to you, in plain language, taken from the clause&apos;s own words.</p></div>
              </li>
              <li className="part part--yellow">
                <div className="part__text"><h3 className="part__h">The way out</h3><p>Any deadline or opt-out your document itself grants you. Only what the document says, never a right it does not mention.</p></div>
              </li>
              <li className="part part--green">
                <div className="part__text"><h3 className="part__h">The severity</h3><p>How much of your leverage the clause removes: your ability to sue, to leave, or to refuse a change.</p></div>
              </li>
              <li className="part part--ink">
                <div className="part__text"><h3 className="part__h">The confidence</h3><p>How sure Redline is that the clause was correctly identified. That is a different question from how much it costs you.</p></div>
              </li>
            </ol>
          </section>

          {/* refusals */}
          <section className="refuse" aria-labelledby="refuse-h">
            <h2 id="refuse-h" className="section-h section-h--invert">What Redline will not do</h2>
            <p className="section-sub section-sub--invert">Paste your document into a general chatbot and it will answer you, but it cannot show you the sentence the answer came from. Redline cannot show you a flag unless it can. These are the sentences Redline is built not to produce.</p>

            <ul className="refusals">
              <li><span className="refusals__bar refusals__bar--magenta" aria-hidden="true"></span>It will not tell you whether to sign.</li>
              <li><span className="refusals__bar refusals__bar--cyan" aria-hidden="true"></span>It will not tell you whether a clause holds where you live.</li>
              <li><span className="refusals__bar refusals__bar--yellow" aria-hidden="true"></span>It will not read a photograph or a scan, because a quote from misread text looks exactly like a correct one.</li>
              <li><span className="refusals__bar refusals__bar--green" aria-hidden="true"></span>It will not answer a question your document does not answer.</li>
              <li><span className="refusals__bar refusals__bar--white" aria-hidden="true"></span>It will not show you a flag it cannot quote.</li>
            </ul>
          </section>

          {/* ranking */}
          <section className="rank" aria-labelledby="rank-h">
            <div className="rank__head">
              <h2 id="rank-h" className="section-h">Ranked by what it takes from you</h2>
              <p className="section-sub">Ordinary is not the same as harmless. Redline ranks a clause by how much leverage it takes: whether you can still sue, still leave, still refuse a change. Rank by how unusual a clause looks instead, and the one that takes the most can end up at the bottom.</p>
            </div>

            <div className="bands">
              <div className="band band--magenta">
                <h3 className="band__h">Removes a lever outright</h3>
                <p>Arbitration and class-action waivers. Unilateral modification. Non-competes.</p>
              </div>
              <div className="band band--yellow">
                <h3 className="band__h">Removes a lever, with a deadline or a cost attached</h3>
                <p>Auto-renewal. Limitation of liability. Indemnification.</p>
              </div>
              <div className="band band--cyan">
                <h3 className="band__h">Costs money, lever intact</h3>
                <p>Fee escalators and late fees.</p>
              </div>
            </div>
          </section>



          {/* question box */}
          <section className="ask" aria-labelledby="ask-h">
            <h2 id="ask-h" className="section-h section-h--struck">Ask it something<span className="struck struck--cyan" aria-hidden="true"></span></h2>
            <p className="section-sub">The question box answers from your document and nowhere else. These two questions went to the document above. The document answered one of them.</p>

            <div className="qa">
              {DEMONSTRATION_QUESTIONS.map((asked) => (
                <div className={`qa__row${asked.answered ? "" : " qa__row--refused"}`} key={asked.question}>
                  <p className="qa__q">{asked.question}</p>
                  <div className="qa__a">
                    <p className={asked.answered ? undefined : "qa__refusal"}>{asked.says}</p>
                    {asked.sourceSentence === null ? null : (
                      <blockquote className="qa__cite">{asked.sourceSentence}</blockquote>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* paste */}
          <section className="paste" id="paste" aria-labelledby="paste-h">
            <h2 id="paste-h" className="paste__h">Try it on your own document</h2>
            <div className="paste__form">
              <div className="paste__foot">
                <a className="btn btn--primary btn--lg" href="/analyse">
                  <span>Paste a document</span>
                  <svg className="btn__arrow" aria-hidden="true"><use href="#arrow" /></svg>
                </a>
                <p className="paste__note">Pasted text or a PDF with a text layer. Your browser reads it, and only the text is kept, never the file. Redline refuses a photograph or a scan and tells you why, rather than reading it badly.</p>
              </div>
            </div>
          </section>

          <footer className="foot">
            <p className="foot__mark"><span className="mark__box" aria-hidden="true">R</span> REDLINE</p>
            <p>Redline describes what a document says and does. It does not give legal advice and it does not tell you whether to sign.</p>
            <p>It does not account for where you live, and never says whether a clause holds there.</p>
            <p>Your browser reads your document. Redline keeps only the text, never the file.</p>
          </footer>

        </main>
      </div>

      <LandingRuntime />
    </>
  );
}
