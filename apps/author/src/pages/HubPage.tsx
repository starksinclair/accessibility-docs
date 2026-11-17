import { Link } from "react-router-dom";
import { BsuLogo } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { hubLinks } from "@/config/links";
import "@/styles/hub.css";

/* `label` stays the full accessible name from links.ts; `title` is the short
   display name the card shows. */
const tools = [
  { ...hubLinks.checker, title: "Checker", tag: "Google Docs", tone: "sky" },
  { ...hubLinks.author, title: "Author", tag: "Editor", tone: "gold" },
  { ...hubLinks.workbench, title: "Workbench", tag: "File repair", tone: "leaf" },
  { ...hubLinks.researcher, title: "The research", tag: "Background", tone: "lake" },
] as const;

const steps = [
  {
    n: "01",
    title: "Learn what fails",
    body:
      "Every finding is written as a teaching note: the rule it breaks, who it blocks, and the fix in plain language — not a WCAG success-criterion number on its own.",
  },
  {
    n: "02",
    title: "Fix it in place",
    body:
      "Headings, alt text, table headers, link text, and reading order are corrected inside the document you are already working in, before it reaches a student.",
  },
  {
    n: "03",
    title: "Ship it tagged",
    body:
      "Export a properly tagged PDF, or send the corrected file back to Canvas. The structure a screen reader needs travels with the file.",
  },
] as const;

const checks = [
  { label: "Heading structure", note: "No skipped levels, one H1" },
  { label: "Image alt text", note: "Meaningful, or marked decorative" },
  { label: "Table headers", note: "Row and column scope" },
  { label: "Link purpose", note: "No bare “click here”" },
  { label: "Color contrast", note: "4.5:1 body, 3:1 large" },
  { label: "Reading order", note: "Visual order matches tag order" },
  { label: "Document language", note: "Declared for pronunciation" },
  { label: "List semantics", note: "Real lists, not dashes" },
] as const;

export function HubPage() {
  return (
    <div className="hub">
      <a className="skip-link" href="#hub-main">
        Skip to main content
      </a>

      <header className="hub-topbar">
        <Link to="/" className="hub-lockup">
          <BsuLogo />
          <span className="hub-lockup-product">Accessibility Workbench</span>
        </Link>

        <nav className="hub-nav" aria-label="Primary">
          <a href="#hub-lesson">How it works</a>
          <a href="#hub-tools">Tools</a>
          <a href="#hub-checks">What we check</a>
          <ThemeToggle />
          <Link className="btn btn-primary btn-sm" to="/workbench">
            Open Workbench
          </Link>
        </nav>
      </header>

      <main id="hub-main">
        {/* ---------------------------------------------------------------- */}
        {/* Educational hero                                                  */}
        {/* ---------------------------------------------------------------- */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-wing hero-wing-top" aria-hidden="true" />
          <div className="hero-wing hero-wing-bottom" aria-hidden="true" />

          <div className="hero-inner">
            <div className="hero-copy">
              <p className="eyebrow">
                <span className="eyebrow-flag">ADA Title II</span>
                Compliance date: April 24, 2026
              </p>

              <h1 id="hero-title">
                <span className="hero-caps">You taught it once.</span>
                <span className="hero-case">
                  Now make it reach <em>everyone</em>.
                </span>
              </h1>

              <p className="lede">
                A syllabus with no headings, a slide deck of untagged images, a
                scanned PDF with no text layer — each one quietly removes a
                student from your course. This workbench finds those gaps,
                explains them, and helps you close them before the file is
                published.
              </p>

              <div className="hero-actions">
                <Link className="btn btn-primary" to="/workbench">
                  Fix an existing file
                </Link>
                <Link className="btn btn-ghost" to="/author">
                  Write something new
                </Link>
              </div>

              <p className="hero-note">
                Built for Ball State faculty · One rules engine behind all three
                tools · Files stay on your device unless you ask for an AI
                suggestion
              </p>
            </div>

            {/* The lesson panel: an annotated document, the way the brand
                annotates its own layouts. */}
            <figure className="lesson" aria-labelledby="lesson-caption">
              <figcaption id="lesson-caption" className="lesson-head">
                <span className="lesson-kicker">Anatomy of a barrier</span>
                <span className="lesson-title">
                  Four things a screen reader cannot recover on its own
                </span>
              </figcaption>

              <div className="lesson-doc">
                <div className="lesson-row">
                  <span className="pin">1</span>
                  <div className="doc-fakeheading" aria-hidden="true">
                    <span className="doc-bigtext" />
                    <span className="doc-tagbad">Bold 18pt — not a heading</span>
                  </div>
                </div>

                <div className="lesson-row">
                  <span className="pin">2</span>
                  <div className="doc-figure" aria-hidden="true">
                    <div className="doc-imagebox">
                      <svg viewBox="0 0 48 36" focusable="false">
                        <rect width="48" height="36" rx="2" />
                        <circle cx="15" cy="13" r="5" />
                        <path d="M4 32l12-14 9 10 7-7 12 11z" />
                      </svg>
                    </div>
                    <span className="doc-tagbad">alt=&quot;image1.png&quot;</span>
                  </div>
                </div>

                <div className="lesson-row">
                  <span className="pin">3</span>
                  <div className="doc-lines" aria-hidden="true">
                    <span className="doc-line" />
                    <span className="doc-line short" />
                    <span className="doc-tagbad">
                      Low contrast · 2.8:1
                    </span>
                  </div>
                </div>

                <div className="lesson-row">
                  <span className="pin">4</span>
                  <div className="doc-table" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span className="doc-tagbad wide">
                      Table used for layout — no header row
                    </span>
                  </div>
                </div>
              </div>

              <ol className="lesson-key">
                <li>
                  <span className="pin pin-sm">1</span>
                  <span>
                    Visual weight is not structure. Screen readers skim by
                    heading level.
                  </span>
                </li>
                <li>
                  <span className="pin pin-sm">2</span>
                  <span>
                    A filename is not a description. Say what the image{" "}
                    <em>means</em> here.
                  </span>
                </li>
                <li>
                  <span className="pin pin-sm">3</span>
                  <span>
                    Contrast below 4.5:1 fails low-vision readers in daylight
                    and on projectors.
                  </span>
                </li>
                <li>
                  <span className="pin pin-sm">4</span>
                  <span>
                    Without header cells, every data cell loses its label.
                  </span>
                </li>
              </ol>
            </figure>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Fact band                                                         */}
        {/* ---------------------------------------------------------------- */}
        <section className="band" aria-label="What this project is built against">
          <dl className="band-grid">
            <div>
              <dt>Standard</dt>
              <dd>WCAG 2.1 Level AA</dd>
            </div>
            <div>
              <dt>Rule</dt>
              <dd>ADA Title II web rule</dd>
            </div>
            <div>
              <dt>Scope</dt>
              <dd>Docs, slides &amp; PDFs</dd>
            </div>
            <div>
              <dt>Engine</dt>
              <dd>One shared ruleset</dd>
            </div>
          </dl>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* How it works                                                      */}
        {/* ---------------------------------------------------------------- */}
        <section
          className="section steps-section"
          id="hub-lesson"
          aria-labelledby="steps-title"
        >
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 id="steps-title">Three moves, in the order you actually work</h2>
            <p className="section-lede">
              The workbench is a teaching tool as much as a checker. Every
              finding carries the reason behind it, so the next document you
              write starts out closer to right.
            </p>
          </div>

          <ol className="steps">
            {steps.map((step) => (
              <li key={step.n} className="step">
                <span className="step-n" aria-hidden="true">
                  {step.n}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Tools                                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="section" id="hub-tools" aria-labelledby="tools-title">
          <div className="section-head">
            <p className="eyebrow">The toolkit</p>
            <h2 id="tools-title">Start where your file already lives</h2>
          </div>

          <ul className="tool-grid">
            {tools.map((tool) => (
              <li key={tool.label} className={`tool tool-${tool.tone}`}>
                <span className="tool-tag">{tool.tag}</span>
                <h3>{tool.title}</h3>
                <p>{tool.description}</p>
                {tool.external ? (
                  <a
                    className="tool-link"
                    href={tool.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                    <span className="visually-hidden">
                      {" "}
                      {tool.label} (opens in a new tab)
                    </span>
                    <span className="tool-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                ) : (
                  <Link className="tool-link" to={tool.href}>
                    Open
                    <span className="visually-hidden"> {tool.label}</span>
                    <span className="tool-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* What we check                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section
          className="section checks-section"
          id="hub-checks"
          aria-labelledby="checks-title"
        >
          <div className="checks-layout">
            <div className="section-head">
              <p className="eyebrow">The ruleset</p>
              <h2 id="checks-title">What every tool looks for</h2>
              <p className="section-lede">
                The same checks run in the Google Docs add-on, the editor, and
                the file repair workbench — so a document cannot pass in one
                place and fail in another.
              </p>
            </div>

            <ul className="check-list">
              {checks.map((check) => (
                <li key={check.label}>
                  <span className="check-mark" aria-hidden="true">
                    <svg viewBox="0 0 16 16" focusable="false">
                      <path
                        d="M2.5 8.5l3.5 3.5 7.5-8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="square"
                      />
                    </svg>
                  </span>
                  <span className="check-body">
                    <strong>{check.label}</strong>
                    <span>{check.note}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Closing CTA                                                       */}
        {/* ---------------------------------------------------------------- */}
        <section className="cta" aria-labelledby="cta-title">
          <div className="cta-wing" aria-hidden="true" />
          <div className="cta-inner">
            <h2 id="cta-title">
              <span className="cta-caps">Ready when your next file is.</span>
            </h2>
            <p>
              Bring a syllabus, a lecture deck, or a scanned reading. You will
              get a ranked list of what to fix first and a plain-English reason
              for each one.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-inverse" to="/workbench">
                Open the Workbench
              </Link>
              <Link className="btn btn-ghost-inverse" to="/author">
                Open the Author editor
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="hub-footer">
        <div className="hub-footer-inner">
          <div className="footer-lockup">
            <BsuLogo orientation="vertical" className="bsu-logo-on-dark" />
            <span className="hub-lockup-product">CS 499 · Senior Project</span>
          </div>
          <p>
            A research prototype for ADA Title II readiness. Files processed in
            the Workbench stay on your device unless you explicitly request an
            AI suggestion. Nothing here is legal advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
