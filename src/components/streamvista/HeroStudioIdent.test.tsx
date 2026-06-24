import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HeroStudioIdent } from "./HeroStudioIdent";

afterEach(() => cleanup());

// Structural regression test — guards the post-redesign contract for the hero
// studio ident: no silver-screen / IMAX / ARRI chrome, no carousel dots /
// indicators, single locked 16:9 stage, large logo that fills the stage,
// brightness + contrast + saturate filter + chromatic aura applied. Catches
// accidental reintroduction of cinema framing, dot indicators, or shrinking
// of the logo.
describe("HeroStudioIdent", () => {
  it("has no silver-screen / IMAX / ARRI chrome and no indicator dots", () => {
    const { container } = render(<HeroStudioIdent />);

    const root = screen.getByTestId("hero-studio-ident");
    expect(root.className).toContain("bg-background");

    const html = container.innerHTML;
    expect(html).not.toMatch(/IMAX/i);
    expect(html).not.toMatch(/ARRI/i);
    expect(html).not.toMatch(/anamorphic/i);
    expect(html).not.toMatch(/silver[- ]?screen/i);
    expect(html).not.toMatch(/2\.39\s*:\s*1/);

    // No carousel/indicator dots of any kind.
    expect(screen.queryAllByTestId("ident-dot-active")).toHaveLength(0);
    expect(screen.queryAllByTestId("ident-dot")).toHaveLength(0);
    // Fail if anyone re-introduces a typical dot row pattern.
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    const looksLikeDot = (el: Element) => {
      const cls = el.className?.toString() ?? "";
      const style = el.getAttribute("style") ?? "";
      const w = parseFloat(/width:\s*(\d+(?:\.\d+)?)px/.exec(style)?.[1] ?? "0");
      return cls.includes("rounded-full") && w > 0 && w <= 24;
    };
    const dotLike = Array.from(container.querySelectorAll("span,div")).filter(looksLikeDot);
    expect(dotLike).toHaveLength(0);
  });

  it("locks a single 16:9 stage that fills the container", () => {
    render(<HeroStudioIdent />);
    const root = screen.getByTestId("hero-studio-ident");
    expect(root.className).toMatch(/aspect-\[16\/9\]/);

    const stage = screen.getByTestId("ident-stage");
    expect(stage.className).toContain("absolute");
    expect(stage.className).toContain("inset-0");
    expect(stage.className).toContain("place-items-center");
  });

  it("renders the logo filling the stage, centered and uncropped", () => {
    render(<HeroStudioIdent />);
    const img = screen.getByRole("img", { name: /studio ident/i })
      .querySelector("img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.className).toContain("object-contain");
    expect(img.className).toContain("w-full");
    expect(img.className).toContain("h-full");
  });

  it("applies a brighter color treatment with chromatic aura", () => {
    render(<HeroStudioIdent />);
    const img = screen.getByRole("img", { name: /studio ident/i })
      .querySelector("img") as HTMLImageElement;
    const filter = img.style.filter;
    expect(filter).toMatch(/brightness\(1\.22\)/);
    expect(filter).toMatch(/contrast\(1\.18\)/);
    expect(filter).toMatch(/saturate\(1\.6\)/);
    // Two drop-shadows: chromatic glow + soft ambient
    const dropShadows = (filter.match(/drop-shadow/g) ?? []).length;
    expect(dropShadows).toBeGreaterThanOrEqual(2);
  });
});
