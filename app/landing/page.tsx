// Temporarily at /landing, not at the root: ticket 01 puts a paste box at the root and ticket 14 later swaps them.
import LandingRuntime from "../../components/LandingRuntime";
import "../landing.css";

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

            <p className="rail__lede">A document you cannot negotiate, read back to you. Every risk quotes the sentence it came from.</p>

            <div className="rail__actions">
              <a className="btn btn--primary" href="#paste">
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

          {/* viewport one: the demonstration */}
          <section className="demo" aria-labelledby="demo-h">
            <div className="demo__head">
              <div className="chips" aria-hidden="true"><span className="chip chip--cyan"></span><span className="chip chip--magenta"></span><span className="chip chip--yellow"></span><span className="chip chip--green"></span><span className="chip chip--ink chip--sm"></span></div>
              <h1 id="demo-h" className="display">
                <span className="display__line">Three sentences in</span>
                <span className="display__line"><span className="hl hl--magenta">this contract</span></span>
                <span className="display__line">cost you something.</span>
              </h1>
              <p className="demo__tag"><span className="demo__tag-chip">Example document</span> Written for this page. It is not a real company&apos;s contract, and Redline did not produce the analysis beside it.</p>
            </div>

            <div className="stage" id="stage">
              <svg className="stage__wires" id="wires" aria-hidden="true" focusable="false"></svg>

              {/* the document */}
              <article className="doc" aria-label="Example document">
                <h2 className="doc__title">Membership and Subscription Agreement</h2>

                <p className="doc__p"><span className="doc__n">1.</span> By completing enrolment you accept these terms in full and confirm that you have had the opportunity to read them. Membership begins on the date of enrolment and continues until terminated in accordance with section 4.</p>

                <p className="doc__p"><span className="doc__n">2.</span> <mark className="src" id="src-01" data-flag="01" data-code="F-01" tabIndex={-1}>Any dispute arising out of or relating to this Agreement shall be resolved exclusively by final and binding arbitration administered on an individual basis, and you waive any right to participate in a class, collective, or representative action.</mark> The arbitrator&apos;s decision shall be final and may be entered as a judgment in any court of competent jurisdiction.</p>

                <p className="doc__p"><span className="doc__n">3.</span> <mark className="src" id="src-02" data-flag="02" data-code="F-02" tabIndex={-1}>We may modify these terms at any time, and your continued use of the facilities after the modified terms are posted constitutes your acceptance of them.</mark> Notice of modification may be given by posting the revised terms at the premises or on the member portal.</p>

                <p className="doc__p"><span className="doc__n">4.</span> <mark className="src" id="src-03" data-flag="03" data-code="F-03" tabIndex={-1}>Your membership renews automatically for successive twelve-month terms unless you deliver written notice of cancellation no later than thirty days before the end of the then-current term.</mark> Fees for a renewed term are charged to the payment method on file on the first day of that term.</p>

                <p className="doc__p"><span className="doc__n">5.</span> Members shall observe posted opening hours and the conduct rules displayed at reception. The Company may refuse admission where a member&apos;s account is in arrears.</p>
              </article>

              {/* the flags */}
              <div className="flags" role="list" aria-label="Flags found in the example document">
                <p className="flags__lede">Three flags, ranked by what they take away. Select one to see the sentence it came from.</p>

                <article className="flag flag--magenta is-open" role="listitem" data-flag="01" aria-describedby="src-01">
                  <button className="flag__bar" type="button" aria-expanded="true">
                    <span className="flag__rank">1</span>
                    <span className="flag__sev">Critical</span>
                    <span className="flag__type">Arbitration and class-action waiver</span>
                    <svg className="flag__arrow" aria-hidden="true"><use href="#arrow" /></svg>
                  </button>
                  <div className="flag__body">
                    <p className="flag__consequence">You keep the contract and lose the courtroom. You cannot sue over this agreement, and you cannot join other members who were treated the same way.</p>
                    <p className="flag__exit"><span className="flag__k">The way out</span>None stated.</p>
                    <p className="flag__ext"><span className="flag__k flag__k--ext">Outside this document</span>Consumers win 9% of arbitration disputes. <cite><a href="https://centerjd.org/content/fact-sheet-forced-arbitration-clauses-and-class-actions-waivers-numbers" rel="noopener">Center for Justice &amp; Democracy, from CFPB data</a></cite></p>
                    <p className="flag__code">F&#8209;01</p>
                  </div>
                </article>

                <article className="flag flag--cyan" role="listitem" data-flag="02" aria-describedby="src-02">
                  <button className="flag__bar" type="button" aria-expanded="false">
                    <span className="flag__rank">2</span>
                    <span className="flag__sev">Critical</span>
                    <span className="flag__type">Unilateral modification</span>
                    <svg className="flag__arrow" aria-hidden="true"><use href="#arrow" /></svg>
                  </button>
                  <div className="flag__body">
                    <p className="flag__consequence">The document you are reading now is not the document you will be bound by. They may change these terms later, and staying a member is treated as your agreement to the change.</p>
                    <p className="flag__exit"><span className="flag__k">The way out</span>None stated.</p>
                    <p className="flag__code">F&#8209;02</p>
                  </div>
                </article>

                <article className="flag flag--yellow" role="listitem" data-flag="03" aria-describedby="src-03">
                  <button className="flag__bar" type="button" aria-expanded="false">
                    <span className="flag__rank">3</span>
                    <span className="flag__sev">High</span>
                    <span className="flag__type">Auto-renewal</span>
                    <svg className="flag__arrow" aria-hidden="true"><use href="#arrow" /></svg>
                  </button>
                  <div className="flag__body">
                    <p className="flag__consequence">You can leave, but only through a window that shuts thirty days before a renewal nobody has to remind you about. Miss it and you owe another twelve months.</p>
                    <p className="flag__exit"><span className="flag__k">The way out</span>Written notice of cancellation, delivered no later than thirty days before the end of the current term.</p>
                    <p className="flag__code">F&#8209;03</p>
                  </div>
                </article>

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
            <p className="section-sub section-sub--invert">A tool that will say anything is a tool you have to check. These are the sentences Redline is built not to produce.</p>

            <ul className="refusals">
              <li><span className="refusals__bar refusals__bar--magenta" aria-hidden="true"></span>It will not tell you whether to sign.</li>
              <li><span className="refusals__bar refusals__bar--cyan" aria-hidden="true"></span>It will not tell you whether a clause holds where you live.</li>
              <li><span className="refusals__bar refusals__bar--yellow" aria-hidden="true"></span>It will not read a photograph or a scan, because a quote from misread text looks exactly like a correct one.</li>
              <li><span className="refusals__bar refusals__bar--green" aria-hidden="true"></span>It will not answer a question your document does not answer.</li>
              <li><span className="refusals__bar refusals__bar--white" aria-hidden="true"></span>It will not show you a risk it cannot quote.</li>
            </ul>
          </section>

          {/* ranking */}
          <section className="rank" aria-labelledby="rank-h">
            <div className="rank__head">
              <h2 id="rank-h" className="section-h">Ranked by what it takes from you</h2>
              <p className="section-sub">An arbitration clause sits in nearly every document you have ever accepted, and being ordinary is not the same as being harmless. Rank by how unusual a clause is and you bury that one, then hand the reader a curiosity instead.</p>
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
            <p className="section-sub">The question box answers from your document and nowhere else, and cites the sentence the same way a flag does.</p>

            <div className="qa">
              <div className="qa__row">
                <p className="qa__q">Can I cancel in month three?</p>
                <div className="qa__a">
                  <p>Not without owing the rest of the term. Cancellation takes written notice delivered at least thirty days before the end of the current twelve-month term.</p>
                  <blockquote className="qa__cite">Your membership renews automatically for successive twelve-month terms unless you deliver written notice of cancellation no later than thirty days before the end of the then-current term.</blockquote>
                </div>
              </div>

              <div className="qa__row qa__row--refused">
                <p className="qa__q">Will this arbitration clause hold up in California?</p>
                <div className="qa__a">
                  <p className="qa__refusal">Your document does not say, and Redline will not guess about a contract you are about to sign. Whether a clause is enforceable depends on where you live, and that is not in the text.</p>
                </div>
              </div>
            </div>
          </section>

          {/* paste */}
          <section className="paste" id="paste" aria-labelledby="paste-h">
            <h2 id="paste-h" className="paste__h">Try it on your own document</h2>
            <form className="paste__form" action="/analyze" method="post">
              <label className="paste__label" htmlFor="doc">Paste your document</label>
              <textarea className="paste__area" id="doc" name="document" rows={7} placeholder="Paste a terms of service, a subscription agreement, a membership contract, or an offer letter."></textarea>
              <div className="paste__foot">
                <button className="btn btn--primary btn--lg" type="submit">
                  <span>Read my document</span>
                  <svg className="btn__arrow" aria-hidden="true"><use href="#arrow" /></svg>
                </button>
                <p className="paste__note">Pasted text or a PDF with a text layer. Your browser reads it, and only the text is kept, never the file. Redline refuses a photograph or a scan and tells you why, rather than reading it badly.</p>
              </div>
            </form>
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
