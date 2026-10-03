import type { ExtractedText } from "@/lib/import/extract/types";
import type { StructureResult } from "@/lib/import/structure/types";
import type { PageBox } from "./types";

/**
 * Where the page numbers / running heads sit — the one kind of writing that
 * stays in the SAME place on every page, so median-stacking can't wash it out.
 * Step 4 already found it; this turns those lines into boxes (in points).
 * Only marks that recur on a good share of the pages count: a divider that
 * appears once in a while moves around and is outvoted like any other text.
 */
export function recurringFurnitureBoxes(
  extracted: ExtractedText,
  structure: StructureResult,
  minPageShare = 0.3
): PageBox[] {
  type Cluster = { box: PageBox; pages: Set<number> };
  const clusters: Cluster[] = [];

  for (const f of structure.furniture) {
    const line = extracted.pages[f.ref.page - 1]?.lines[f.ref.index];
    if (!line) continue;
    const pad = Math.max(2, line.size * 0.3);
    const box: PageBox = { left: line.x - pad, top: line.top - pad, right: line.right + pad, bottom: line.bottom + pad };
    const home = clusters.find((c) => {
      const overlapY = Math.min(c.box.bottom, box.bottom) - Math.max(c.box.top, box.top);
      const overlapX = Math.min(c.box.right, box.right) - Math.max(c.box.left, box.left);
      return overlapY > 0.5 * Math.min(c.box.bottom - c.box.top, box.bottom - box.top) && overlapX > 0;
    });
    if (home) {
      home.box = {
        left: Math.min(home.box.left, box.left),
        top: Math.min(home.box.top, box.top),
        right: Math.max(home.box.right, box.right),
        bottom: Math.max(home.box.bottom, box.bottom),
      };
      home.pages.add(f.ref.page);
    } else {
      clusters.push({ box, pages: new Set([f.ref.page]) });
    }
  }
  const needed = Math.max(2, Math.ceil(extracted.pages.length * minPageShare));
  return clusters.filter((c) => c.pages.size >= needed).map((c) => c.box);
}
