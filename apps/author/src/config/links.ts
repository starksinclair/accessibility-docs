/**
 * External and internal destinations for the hub page (FR-1.4).
 */
export const hubLinks = {
  researcher: {
    href: "https://sinclairnzenwata.com",
    label: "About the researcher",
    description:
      "Learn about Sinclair Nzenwata and the research behind this accessibility workbench.",
    external: true,
  },
  checker: {
    href: "https://docs.google.com/document/d/1MJitDY4B4eKFei_fvgcy-C6Vwit8reCLoMXnKSyIZuY/edit",
    label: "Checker (Google Docs add-on)",
    description:
      "Open, then choose Accessibility → Open checker to scan a Google Doc with the shared rules engine.",
    external: true,
  },
  author: {
    href: "/author",
    label: "Author (accessible editor)",
    description:
      "Write structured documents in TipTap, catch accessibility issues at save time, and export a tagged PDF.",
    external: false,
  },
  workbench: {
    href: "/workbench",
    label: "Workbench (fix existing files)",
    description:
      "Upload PowerPoint and PDF course files, rank what to fix first, and apply human-reviewed repairs.",
    external: false,
  },
} as const;
