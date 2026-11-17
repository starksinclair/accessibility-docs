/**
 * The Ball State wing graphic (Brand Guidelines p.66), drawn as the "solid"
 * variation. Per the guidelines this device is NOT a logo, so it is never the
 * sole identifier — it always sits beside the university wordmark.
 */
export function WingMark({ title }: { title?: string }) {
  return (
    <svg
      className="wing-mark"
      viewBox="0 0 48 32"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d="M0 0h18l6 10L30 0h18L24 32Z" fill="currentColor" />
    </svg>
  );
}

const ART = {
  horizontal: {
    red: "/bsu-logo-horizontal.png",
    reverse: "/bsu-logo-horizontal-reverse.png",
    width: 589,
    height: 200,
  },
  vertical: {
    red: "/bsu-logo-vertical.png",
    reverse: "/bsu-logo-vertical-reverse.png",
    width: 259,
    height: 300,
  },
} as const;

/**
 * The institutional logo (Brand Guidelines pp.52–58), used whole and unaltered:
 * the shield and the wording always travel together, never cropped, recoloured,
 * tilted or typeset.
 *
 * Both official colour variants are rendered and CSS shows one per theme. Light
 * gets the two-colour logo straight on the page, which p.55 calls the preferred
 * use on white. Dark gets the all-white reverse, because the two-colour version
 * sets its wording in black — invisible on carbon — and p.56 rules out the red
 * logo on a dark field outright.
 *
 * Minimum reproduction heights (p.53) are enforced in CSS: 36px horizontal,
 * 54px vertical. The surrounding clear space is the x-height rule from p.54.
 */
export function BsuLogo({
  orientation = "horizontal",
  className,
}: {
  orientation?: keyof typeof ART;
  className?: string;
}) {
  const art = ART[orientation];
  return (
    <span
      className={`bsu-logo bsu-logo-${orientation}${
        className ? ` ${className}` : ""
      }`}
      role="img"
      aria-label="Ball State University"
    >
      <img
        className="bsu-logo-art bsu-logo-art-red"
        src={art.red}
        alt=""
        aria-hidden="true"
        width={art.width}
        height={art.height}
        decoding="async"
      />
      <img
        className="bsu-logo-art bsu-logo-art-reverse"
        src={art.reverse}
        alt=""
        aria-hidden="true"
        width={art.width}
        height={art.height}
        decoding="async"
      />
    </span>
  );
}
