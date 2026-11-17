import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractPptxMedia } from "../src/index.js";
import { FIXTURES, readFixture } from "./helpers.js";

async function bytesOf(code: string, outcome: "fail" | "pass", name: string) {
  return new Uint8Array(
    await readFile(join(FIXTURES, code, outcome, `${name}.pptx`))
  );
}

describe("extractPptxMedia", () => {
  it("returns the image parts the figure nodes point at", async () => {
    const model = await readFixture("A004", "pass", "image-with-alt-description");
    const images = await extractPptxMedia(
      await bytesOf("A004", "pass", "image-with-alt-description")
    );
    const figure = model.nodes.find((node) => node.type === "figure");

    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      path: "ppt/media/image1.png",
      contentType: "image/png",
    });
    expect(images[0].bytes.byteLength).toBeGreaterThan(0);
    // The viewer looks images up by the figure's src, so the two must agree.
    expect(images.map((image) => image.path)).toContain(figure?.src);
  });

  it("returns nothing for a deck with no pictures", async () => {
    expect(
      await extractPptxMedia(await bytesOf("A013", "pass", "every-slide-titled"))
    ).toEqual([]);
  });

  it("refuses a file that is not a deck", async () => {
    await expect(
      extractPptxMedia(new TextEncoder().encode("%PDF-1.7\n"))
    ).rejects.toThrow(/not a PowerPoint/);
  });
});
