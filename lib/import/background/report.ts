import type { BackgroundResult } from "./types";

const QUALITY = { good: "GOOD", fair: "FAIR", poor: "POOR" } as const;

export function formatBackgroundReport(r: BackgroundResult, opts: { fileName?: string; ms?: number } = {}): string {
  const out: string[] = [];
  out.push("KoraKagaj import — background extraction report");
  out.push(
    `${opts.fileName ? opts.fileName + " · " : ""}page ${r.page.width.toFixed(0)}×${r.page.height.toFixed(0)}pt${opts.ms !== undefined ? ` · ${(opts.ms / 1000).toFixed(1)}s` : ""}`
  );
  out.push("");
  out.push(`METHOD     ${r.method}`);
  out.push(`QUALITY    ${QUALITY[r.quality]}   → recommends ${r.recommendation === "use-image" ? "the picture" : "a flat colour"}`);
  if (r.image) {
    out.push(`PICTURE    ${r.image.width}×${r.image.height}px · ${r.image.mime.replace("image/", "").toUpperCase()} · ${(r.image.bytes.length / 1024).toFixed(0)} KB`);
  } else {
    out.push("PICTURE    none");
  }
  out.push(`FLAT       ${r.flatColor.hex}  (${r.flatColor.dark ? "dark" : "light"} — sampled from the page edge)`);
  out.push(
    `SAMPLES    ${r.method === "embedded-image" ? "n/a (taken directly)" : `${r.samples.pages.length} of ${r.samples.eligible} usable pages`}${r.consistency !== null ? ` · ${(r.consistency * 100).toFixed(0)}% of sampled pages agree with the result` : ""}`
  );
  if (r.samples.pages.length) out.push(`           pages ${r.samples.pages.join(", ")}`);
  if (r.cleaned.length) {
    out.push(`PAINTED    ${r.cleaned.length} recurring mark${r.cleaned.length === 1 ? "" : "s"}: ${r.cleaned.map((b) => `x ${b.left.toFixed(0)}–${b.right.toFixed(0)}, y ${b.top.toFixed(0)}–${b.bottom.toFixed(0)}pt`).join("; ")}`);
  }
  if (r.notes.length) {
    out.push("");
    for (const n of r.notes) out.push(`NOTE       ${n}`);
  }
  return out.join("\n");
}
