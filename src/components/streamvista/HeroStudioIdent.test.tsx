import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { HeroStudioIdent } from "./HeroStudioIdent";

afterEach(() => cleanup());

// Structural regression test — guards the post-redesign contract for the hero
// studio ident: no silver-screen / IMAX / ARRI chrome, single unified
// background, large centered logo, brightness + contrast + saturate filter
// applied. Catches accidental reintroduction of cinema framing or shrinking
// of the logo.
describe("HeroStudioIdent", () => {
  it("renders a single unified backdrop with no silver-screen / IMAX / ARRI chrome", () => {
    const { container } = render(<HeroStudioIdent />);

    const root = screen.getByTestId("hero-studio-ident");
    expect(root.className).toContain("bg-background");

    const html = container.innerHTML;
    expect(html).not.toMatch(/IMAX/i);
    expect(html).not.toMatch(/ARRI/i);
    expect(html).not.toMatch(/anamorphic/i);
    expect(html).not.toMatch(/silver[- ]?screen/i);
    expect(html).not.toMatch(/2\.39\s*:\s*1/);
  });

  it("renders the active logo centered, large, and uncropped", () => {
    render(<HeroStudioIdent />);
    const img = screen.getByRole("img", { name: /studio ident/i })
      .querySelector("img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.className).toContain("object-contain");
    expect(img.className).toContain("mx-auto");
    expect(img.className).toContain("max-w-full");
    expect(img.className).toContain("max-h-full");
  });

  it("applies a brighter color treatment with chromatic aura", () => {
    render(<HeroStudioIdent />);
    const img = screen.getByRole("img", { name: /studio ident/i })
      .querySelector("img") as HTMLImageElement;
    const filter = img.style.filter;
    expect(filter).toMatch(/brightness\(1\.22\)/);
    expect(filter).toMatch(/contrast\(1\.18\)/);
    expect(filter).toMatch(/saturate\(1\.6\)/);
    expect(filter).toMatch(/drop-shadow/);
  });

  it("renders no carousel dots", () => {
    render(<HeroStudioIdent />);
    expect(screen.queryAllByTestId("ident-dot-active")).toHaveLength(0);
    expect(screen.queryAllByTestId("ident-dot")).toHaveLength(0);
  });
});
