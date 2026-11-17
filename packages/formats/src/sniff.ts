/**
 * Format detection by file signature rather than by extension (FR-6.2).
 *
 * A renamed file is the common case here, not an attack: faculty send each
 * other "lecture.pptx" that is really a saved-as-PDF, or a .ppt someone renamed
 * by hand. Each outcome maps to a message that says what to do next.
 */
export type SniffedFormat =
  | "pptx"
  | "pdf"
  | "legacy-ppt"
  /** A ZIP container that is not an Open XML presentation. */
  | "zip"
  | "unknown";

const SIGNATURES: { format: SniffedFormat; bytes: number[] }[] = [
  { format: "zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
  { format: "pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  {
    format: "legacy-ppt",
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  },
];

/**
 * Looks at the first bytes of a file, plus the extension only to tell a .pptx
 * apart from another ZIP-based format (the ZIP signature cannot).
 */
export function sniffFormat(
  bytes: Uint8Array,
  fileName?: string
): SniffedFormat {
  for (const { format, bytes: signature } of SIGNATURES) {
    if (
      bytes.length >= signature.length &&
      signature.every((byte, index) => bytes[index] === byte)
    ) {
      if (format !== "zip") {
        return format;
      }
      return /\.pptx$/i.test(fileName ?? "") ? "pptx" : "zip";
    }
  }

  return "unknown";
}
