// =============================================================================
// Career Player Comp — client-side Word (.docx) + plain-text extraction
//
// Same privacy contract as lib/pdf.ts: the file never leaves the browser; only
// the extracted plain text is sent. mammoth is dynamically imported so it stays
// out of the server bundle and off the initial page load.
//
// Legacy binary .doc (pre-2007) is NOT supported — no reliable browser parser
// exists; the UI steers those users to re-save as .docx/PDF or paste.
// =============================================================================

const MIN_USEFUL_CHARS = 50;

export interface ExtractResult {
  text: string;
  usable: boolean;
}

/** Extract text from a .docx File entirely in the browser. */
export async function extractDocxText(file: File): Promise<ExtractResult> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  const text = (value ?? "").trim();
  return { text, usable: text.length >= MIN_USEFUL_CHARS };
}

/** Read a plain-text file. Trivial, but keeps the same ExtractResult contract. */
export async function extractTxtText(file: File): Promise<ExtractResult> {
  const text = (await file.text()).trim();
  return { text, usable: text.length >= MIN_USEFUL_CHARS };
}
