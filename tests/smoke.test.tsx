// Smoke tests for CPC. They build nothing paid: no report is generated and no
// model call is made. Run with `npm test`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Landing from "@/app/components/Landing";
import CareerUpload from "@/app/components/CareerUpload";

beforeEach(() => {
  // jsdom has no matchMedia; the card tilt asks for reduced motion.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: true,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
  // The landing page asks /api/scouted for a count. Answer it with nothing.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 404 })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("front page", () => {
  it("renders a headline and a start button", () => {
    const { container } = render(<Landing onStart={() => {}} onHome={() => {}} />);
    expect(container.querySelector("h1")).not.toBeNull();
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  it("calls onStart when the hero button is pressed", () => {
    const onStart = vi.fn();
    const { container } = render(<Landing onStart={onStart} onHome={() => {}} />);
    const buttons = Array.from(container.querySelectorAll("button"));
    const cta = buttons.find((b) => /scout|start|begin|read/i.test(b.textContent ?? ""));
    expect(cta, "a start button").toBeDefined();
    fireEvent.click(cta!);
    expect(onStart).toHaveBeenCalled();
  });
});

describe("sample report", () => {
  it("shows the sample scouting card on the front page", () => {
    render(<Landing onStart={() => {}} onHome={() => {}} />);
    expect(screen.getAllByText(/Gin[oó]bili/i).length).toBeGreaterThan(0);
  });
});

describe("resume form checks", () => {
  it("offers no Continue button while the resume box is empty", () => {
    render(<CareerUpload onContinue={() => {}} onHome={() => {}} />);
    expect(screen.queryByText(/Continue to Questions/i)).toBeNull();
  });

  it("still offers none for spaces only, and never calls onContinue", () => {
    const onContinue = vi.fn();
    render(<CareerUpload onContinue={onContinue} onHome={() => {}} />);
    const box = screen.getByRole("textbox");
    fireEvent.change(box, { target: { value: "   \n  " } });
    expect(screen.queryByText(/Continue to Questions/i)).toBeNull();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("offers Continue once there is pasted text", () => {
    render(<CareerUpload onContinue={() => {}} onHome={() => {}} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Ten years as an editor." },
    });
    expect(screen.getByText(/Continue to Questions/i)).toBeDefined();
  });
});
