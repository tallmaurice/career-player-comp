"use client";

// =============================================================================
// Screen 01b — CAREER UPLOAD ("First, let's pull your career film.")
// Faithful conversion of the design export's 01b (desktop) + 01bM (mobile 390)
// artboards. Presentational only: it takes CareerUploadProps, renders, and calls
// the callbacks. No data fetching, no global state.
//
// Two equal inputs:
//   Option A — drop / click a résumé or LinkedIn PDF (the .drop-zone)
//   Option B — paste work history into a textarea (the .paste-area)
//
// PDF text extraction runs CLIENT-SIDE (lib/pdf.ts via pdfjs-dist): the file
// never leaves the browser, only the extracted text is passed up. On select we
// extract, hold the text, and show status on the chip. If extraction yields
// under ~50 chars (image-only / scanned PDF), we surface the paste path. The
// pasted text wins if both are present. onContinue receives the best text we
// have (extracted, else pasted).
// =============================================================================

import { useRef, useState } from "react";
import type { CareerUploadProps } from "@/lib/types";
import { extractPdfText } from "@/lib/pdf";

// Shared inline values pulled verbatim from the export so desktop + mobile stay
// in sync. This screen is a single fluid layout (no separate mobile artboard),
// so it has no JS breakpoint switch; it reflows responsively on its own.
const GREEN = "#2f6043";
const INK = "#211e17";
const MUTED = "#6b655a";
const FAINT = "#a8a090";
const PAPER = "#f4eede";
const PAPER_HI = "#faf6ea";
const MONO = "'JetBrains Mono', monospace";
const DISPLAY = "'Barlow Condensed'";
const BODY = "'Inter'";

// File-extraction status, shown on the "ADDED" chip. "notpdf" = a non-PDF was
// dropped/selected (never extracted; steer to the paste path).
type FileStatus = "reading" | "ok" | "thin" | "error" | "notpdf" | "olddoc";

export default function CareerUpload({
  onContinue,
  onHome,
  initialText,
}: CareerUploadProps) {
  // Prefill with any career text already captured this session (BACK from Q1
  // lands here), so the earlier paste/extraction isn't silently wiped and the
  // Continue CTA stays available.
  const [pasteText, setPasteText] = useState(initialText ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState("");
  const [fileStatus, setFileStatus] = useState<FileStatus | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPdfHelp, setShowPdfHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    fileInputRef.current?.click();
  }

  // Clear the attached file and return the zone to its empty state. Reset the
  // input's value too, so re-selecting the *same* file still fires onChange.
  function clearFile() {
    setFileName(null);
    setFileText("");
    setFileStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // The CTA appears once there's *some* usable input. A thin/failed PDF alone
  // does NOT enable it — the user must paste; a paste alone always works.
  const hasUsableFile = fileStatus === "ok" && fileText.trim().length > 0;
  const hasInput = pasteText.trim().length > 0 || hasUsableFile;

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    // PDF, Word (.docx), or plain text. Extraction happens here, in the browser.
    const name = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    const isDocx =
      name.endsWith(".docx") ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const isTxt = name.endsWith(".txt") || file.type === "text/plain";
    if (!isPdf && !isDocx && !isTxt) {
      // Unsupported (drag-and-drop skips the picker's accept filter): surface it
      // on the chip instead of silently ignoring the drop. Legacy binary .doc
      // gets its own message — no reliable browser parser exists for it.
      setFileName(file.name);
      setFileText("");
      setFileStatus(name.endsWith(".doc") ? "olddoc" : "notpdf");
      return;
    }

    setFileName(file.name);
    setFileStatus("reading");
    setFileText("");
    try {
      const { text, usable } = isPdf
        ? await extractPdfText(file)
        : isDocx
          ? await (await import("@/lib/docx")).extractDocxText(file)
          : await (await import("@/lib/docx")).extractTxtText(file);
      if (usable) {
        setFileText(text);
        setFileStatus("ok");
      } else {
        // image-only / scanned PDF: not enough text — push to the paste path.
        setFileText("");
        setFileStatus("thin");
      }
    } catch {
      setFileText("");
      setFileStatus("error");
    }
  }

  function handleContinue() {
    if (!hasInput) return;
    // Prefer pasted text if present (the user's most deliberate input); else the
    // extracted PDF text. A thin/failed PDF contributes nothing here.
    const paste = pasteText.trim();
    onContinue(paste.length ? paste : fileText.trim());
  }

  return (
    <div
      className="paper-bg"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        color: INK,
        fontFamily: `${BODY}, sans-serif`,
        overflowX: "hidden",
      }}
    >
      {/* ---- header bar ---- */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "clamp(18px, 3vw, 28px) clamp(22px, 5vw, 56px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={onHome}
            aria-label="Career Player Comp — home"
            className="cpc-home"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <div style={{ width: 8, height: 8, background: GREEN }} />
            <span
              style={{
                font: `600 13px ${DISPLAY}`,
                letterSpacing: "0.22em",
                color: INK,
              }}
            >
              CAREER PLAYER COMP
            </span>
          </button>
        </div>
        <div
          style={{
            font: `400 11px ${MONO}`,
            color: FAINT,
            letterSpacing: "0.18em",
            whiteSpace: "nowrap",
          }}
        >
          [ STEP 01 · INTAKE ]
        </div>
      </header>

      {/* ---- body ---- */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          maxWidth: 1000,
          margin: "0 auto",
          padding: "clamp(28px, 5vw, 40px) clamp(22px, 5vw, 56px)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            font: `400 11px ${MONO}`,
            letterSpacing: "0.28em",
            color: GREEN,
            marginBottom: "clamp(14px, 2vw, 20px)",
          }}
        >
          [ INTAKE — CAREER FILM ]
        </div>
        <h1
          style={{
            font: `700 clamp(38px, 6vw, 64px)/0.98 ${DISPLAY}`,
            color: INK,
            margin: "0 0 16px",
            textTransform: "uppercase",
            letterSpacing: "-0.008em",
          }}
        >
          First, let&rsquo;s pull your career film.
        </h1>
        <p
          style={{
            font: `400 clamp(14px, 1.6vw, 17px)/1.5 ${BODY}`,
            color: MUTED,
            margin: "0 0 clamp(28px, 4vw, 44px)",
          }}
        >
          The more we have, the more accurate your comp.
        </p>

        {/* two equal options; stacks under 720px via auto-fit */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: "clamp(22px, 3vw, 28px)",
            alignItems: "stretch",
          }}
        >
          {/* ---- Option A: PDF drop / browse ---- */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                font: `500 10px ${MONO}`,
                color: GREEN,
                letterSpacing: "0.22em",
                marginBottom: 12,
              }}
            >
              [ OPTION A ]
            </div>
            <div
              className={`drop-zone${isDragging ? " is-dragging" : ""}`}
              role="button"
              tabIndex={0}
              aria-label="Upload résumé or LinkedIn PDF"
              onClick={openPicker}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openPicker();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!isDragging) setIsDragging(true);
              }}
              onDragLeave={(e) => {
                // ignore drags that just move between children of the zone
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsDragging(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              style={{
                flex: 1,
                border: "1.5px dashed rgba(47,96,67,0.5)",
                borderRadius: 6,
                background: PAPER,
                padding: "clamp(22px, 3vw, 32px) clamp(20px, 3vw, 28px)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  font: `600 clamp(18px, 2.4vw, 22px) ${DISPLAY}`,
                  color: INK,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  marginBottom: 8,
                }}
              >
                Upload résumé or LinkedIn PDF
              </div>
              <div
                style={{
                  font: `400 clamp(12px, 1.4vw, 13px) ${BODY}`,
                  color: MUTED,
                  marginBottom: "clamp(16px, 2vw, 22px)",
                }}
              >
                Drop a file here, or use the button below. PDF, Word (.docx),
                or plain text. A résumé or a LinkedIn export both work.
              </div>

              {/* explicit, obvious upload button — so the zone isn't an invisible
                  target. Stops propagation so it doesn't double-fire the zone's
                  own onClick. Relabels once a file is successfully attached. */}
              <button
                type="button"
                className="upload-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  openPicker();
                }}
                style={{
                  alignSelf: "flex-start",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: hasUsableFile ? "transparent" : GREEN,
                  color: hasUsableFile ? GREEN : "#f1ece0",
                  border: `1.5px solid ${GREEN}`,
                  padding: "11px 18px",
                  font: `600 12px ${BODY}`,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  borderRadius: 4,
                  marginBottom: "clamp(16px, 2vw, 20px)",
                }}
              >
                <span aria-hidden style={{ font: `600 14px ${BODY}`, lineHeight: 1 }}>
                  {hasUsableFile ? "↻" : "↑"}
                </span>
                {hasUsableFile ? "Choose a different file" : "Choose file"}
              </button>

              {/* LinkedIn-PDF helper — the #1 upload friction is people not
                  finding where to export their profile as a PDF. There are four
                  paths (desktop/mobile x free/Premium) and LinkedIn labels them
                  differently, which is too much to show always-on. So: a visible
                  "Need your LinkedIn PDF?" prompt with a tappable info toggle
                  that reveals the full matrix inline (no navigation away). Sits
                  AFTER the CTA so it never pushes the button down; hidden once a
                  file is attached. */}
              {!hasUsableFile && (
                <div
                  // The drop-zone wrapping this opens the file picker on click;
                  // stop clicks inside the helper from bubbling up to it.
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    alignSelf: "stretch",
                    maxWidth: 480,
                    marginBottom: "clamp(16px, 2vw, 20px)",
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPdfHelp((v) => !v);
                    }}
                    aria-expanded={showPdfHelp}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      font: `600 11px ${BODY}`,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: GREEN,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: `1.5px solid ${GREEN}`,
                        font: `700 10px ${BODY}`,
                        lineHeight: 1,
                      }}
                    >
                      i
                    </span>
                    Need your LinkedIn PDF?
                    <span aria-hidden style={{ font: `600 9px ${BODY}`, opacity: 0.7 }}>
                      {showPdfHelp ? "▲" : "▼"}
                    </span>
                  </button>

                  {showPdfHelp && (
                    <div
                      style={{
                        marginTop: 9,
                        borderLeft: `2px solid ${GREEN}`,
                        paddingLeft: 13,
                        font: `400 12.5px/1.55 ${BODY}`,
                        color: MUTED,
                      }}
                    >
                      <div style={{ marginBottom: 9 }}>
                        <div
                          style={{
                            font: `600 11px ${BODY}`,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: INK,
                            marginBottom: 3,
                          }}
                        >
                          On your phone
                        </div>
                        The LinkedIn app is a dead end here (no PDF export,
                        no copying text). Best move on a phone:{" "}
                        <strong style={{ color: INK, fontWeight: 600 }}>
                          upload a r&eacute;sum&eacute; you already have (PDF or Word)
                        </strong>{" "}
                        &mdash; the fuller the r&eacute;sum&eacute;, the deeper
                        the report. In a pinch,{" "}
                        <strong style={{ color: INK, fontWeight: 600 }}>
                          type your history into the box
                        </strong>
                        : the scout reads whatever you give it, so more detail
                        means a sharper read.
                      </div>
                      <div>
                        <div
                          style={{
                            font: `600 11px ${BODY}`,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: INK,
                            marginBottom: 3,
                          }}
                        >
                          On a computer (linkedin.com)
                        </div>
                        Your profile &rarr; the{" "}
                        <strong style={{ color: INK, fontWeight: 600 }}>
                          More (<span aria-hidden>&bull;&bull;&bull;</span>)
                        </strong>{" "}
                        button &rarr; Save to PDF. On{" "}
                        <strong style={{ color: INK, fontWeight: 600 }}>Premium</strong>,
                        it&rsquo;s under{" "}
                        <strong style={{ color: INK, fontWeight: 600 }}>Resources</strong>{" "}
                        instead.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* file chip — only after a PDF is attached */}
              {fileName && (
                <>
                  <div
                    className={`file-chip${fileStatus === "ok" ? " is-ok" : ""}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      background: fileStatus === "ok" ? "rgba(47,96,67,0.07)" : PAPER_HI,
                      border:
                        fileStatus === "ok"
                          ? "1px solid rgba(47,96,67,0.45)"
                          : "1px solid rgba(33,30,23,0.16)",
                      borderLeft:
                        fileStatus === "ok"
                          ? `3px solid ${GREEN}`
                          : fileStatus === "thin" || fileStatus === "error" || fileStatus === "notpdf" || fileStatus === "olddoc"
                            ? "3px solid #bd5024"
                            : "1px solid rgba(33,30,23,0.16)",
                      borderRadius: 4,
                    }}
                  >
                    <div
                      className="file-no"
                      style={{
                        font: `500 10px ${MONO}`,
                        color: GREEN,
                        border: "1px solid rgba(47,96,67,0.4)",
                        padding: "2px 5px",
                        borderRadius: 2,
                        transform: "none",
                        background: "transparent",
                      }}
                    >
                      {fileStatus === "notpdf" || fileStatus === "olddoc"
                        ? "FILE"
                        : fileName?.toLowerCase().endsWith(".docx")
                          ? "DOCX"
                          : fileName?.toLowerCase().endsWith(".txt")
                            ? "TXT"
                            : "PDF"}
                    </div>
                    <div
                      style={{
                        font: `500 13px ${BODY}`,
                        color: INK,
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fileName}
                    </div>
                    <div
                      style={{
                        font: `500 11px ${MONO}`,
                        color:
                          fileStatus === "ok"
                            ? GREEN
                            : fileStatus === "reading"
                              ? MUTED
                              : "#bd5024",
                        letterSpacing: "0.08em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fileStatus === "reading"
                        ? "READING…"
                        : fileStatus === "ok"
                          ? "ADDED ✓"
                          : "CAN'T READ"}
                    </div>
                    {/* remove / clear — returns the zone to its empty state.
                        Stops propagation so it doesn't reopen the file picker. */}
                    <button
                      type="button"
                      className="chip-remove"
                      aria-label={`Remove ${fileName}`}
                      title="Remove file"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFile();
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        flexShrink: 0,
                        background: "transparent",
                        border: "none",
                        borderRadius: 3,
                        color: MUTED,
                        font: `400 15px ${BODY}`,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* thin / failed / non-PDF: steer to the paste box (Option B) */}
                  {(fileStatus === "thin" || fileStatus === "error" || fileStatus === "notpdf" || fileStatus === "olddoc") && (
                    <div
                      style={{
                        marginTop: 10,
                        font: `400 12px/1.5 ${BODY}`,
                        color: "#bd5024",
                      }}
                    >
                      {fileStatus === "thin"
                        ? "We couldn't pull readable text from that file (it may be scanned or image-only). "
                        : fileStatus === "notpdf"
                          ? "That file type won't work — PDF, Word (.docx), or plain text only. "
                          : fileStatus === "olddoc"
                            ? "That's the old Word format (.doc) — re-save it as .docx or PDF first. "
                            : "Something went wrong reading that file. "}
                      Or paste your work history in the box on the right instead.
                    </div>
                  )}
                </>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain"
                onChange={(e) => handleFiles(e.target.files)}
                style={{ display: "none" }}
              />
            </div>
          </div>

          {/* ---- Option B: paste work history ---- */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                font: `500 10px ${MONO}`,
                color: GREEN,
                letterSpacing: "0.22em",
                marginBottom: 12,
              }}
            >
              [ OPTION B ]
            </div>
            <div
              className="paste-area"
              style={{
                flex: 1,
                border: "1px solid rgba(33,30,23,0.22)",
                borderRadius: 6,
                background: PAPER,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "clamp(18px, 3vw, 32px) clamp(18px, 2.4vw, 26px) 4px" }}>
                <div
                  style={{
                    font: `600 clamp(18px, 2.4vw, 22px) ${DISPLAY}`,
                    color: INK,
                    textTransform: "uppercase",
                    letterSpacing: "0.02em",
                    marginBottom: 8,
                  }}
                >
                  Paste your work history
                </div>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={
                  "e.g. Senior Electrician, Turner Construction, 2018–present\nApprentice Electrician, Local 3 IBEW, 2014–2018"
                }
                aria-label="Paste your work history"
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  resize: "none",
                  padding: "6px clamp(18px, 2.4vw, 26px) 14px",
                  font: `400 14px/1.65 ${BODY}`,
                  color: INK,
                  outline: "none",
                  minHeight: 150,
                  boxSizing: "border-box",
                }}
              />
              <div
                style={{
                  padding: "0 clamp(18px, 2.4vw, 26px) clamp(16px, 2.4vw, 22px)",
                  font: `400 12px/1.5 ${BODY}`,
                  color: FAINT,
                }}
              >
                Job titles, companies, and years only &mdash; not a whole LinkedIn page.
              </div>
            </div>
          </div>
        </div>

        {/* ---- continue (appears once there's input) ---- */}
        <div
          style={{
            marginTop: "clamp(26px, 4vw, 36px)",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          {hasInput && (
            <button
              type="button"
              className="cta-green"
              onClick={handleContinue}
              style={{
                background: GREEN,
                color: "#f1ece0",
                border: "none",
                padding: "18px 32px",
                font: `600 14px ${BODY}`,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                borderRadius: 4,
              }}
            >
              Continue to Questions &nbsp;&rarr;
            </button>
          )}
          <div
            style={{
              font: `400 11px ${MONO}`,
              color: FAINT,
              letterSpacing: "0.16em",
            }}
          >
            [ EITHER INPUT WORKS ]
          </div>
        </div>
      </main>

      {/* ---- footer ---- */}
      <footer
        style={{
          margin: "0 clamp(22px, 5vw, 56px) 30px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          paddingTop: 20,
        }}
      >
        <div
          style={{
            font: `400 11px ${MONO}`,
            color: FAINT,
            letterSpacing: "0.18em",
          }}
        >
          [ NOTHING STORED · PDF READ IN YOUR BROWSER ]
        </div>
        <div
          style={{
            font: `400 11px ${MONO}`,
            color: FAINT,
            letterSpacing: "0.18em",
          }}
        >
          careerplayercomp.com
        </div>
      </footer>
    </div>
  );
}
