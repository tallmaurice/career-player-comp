// =============================================================================
// Career Player Comp — client-side PDF text extraction (pdfjs-dist)
//
// The privacy promise is hard: the résumé/LinkedIn PDF never leaves the browser.
// We extract its text on the client and only ever send the resulting plain text
// (the "career film") to the server. The raw file is never uploaded.
//
// pdfjs-dist needs a worker. We load it from the same versioned package via a
// bundler URL so there's no CDN dependency and the version always matches.
// =============================================================================

const MIN_USEFUL_CHARS = 50;

export interface ExtractResult {
  /** The extracted text (may be empty / very short on image-only PDFs). */
  text: string;
  /** True when there's enough text to comp; false means surface the paste path. */
  usable: boolean;
}

/**
 * Extract text from a PDF File entirely in the browser.
 * Returns { text, usable }. `usable` is false when the extracted text is under
 * ~50 chars (e.g. a scanned/image-only résumé) — the caller should then steer
 * the user to the paste box. Throws only on a hard parse failure.
 */
export async function extractPdfText(file: File): Promise<ExtractResult> {
  // Dynamic import keeps pdfjs out of the server bundle and off the initial load;
  // this module is only ever called from a client event handler.
  const pdfjs = await import("pdfjs-dist");

  // Wire the worker from the package itself (no external CDN), so the version
  // always matches the library. `new URL(..., import.meta.url)` is the worker
  // reference form both webpack and Turbopack resolve to a bundled asset.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    parts.push(pageText);
  }

  // Collapse runs of whitespace; pdf text comes out token-spaced.
  const text = parts.join("\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  return { text, usable: text.length >= MIN_USEFUL_CHARS };
}
