"""
Visual assertions for the hero studio ident — measures rendered logo
brightness, saturation, and chromatic-aura intensity at multiple
viewports x themes by sampling pixels directly from screenshots.

Run manually:   python3 tests/visual/hero-ident.py
Exits non-zero if any sample falls below the minimum thresholds.
"""

import asyncio, sys, json
from pathlib import Path
from PIL import Image
from playwright.async_api import async_playwright

OUT = Path(__file__).parent / "shots"
OUT.mkdir(exist_ok=True)

VIEWPORTS = [
    ("xs",      320, 720),
    ("mobile",  390, 800),
    ("tablet",  768, 1100),
    ("desktop", 1280, 900),
]
THEMES = ["light", "dark"]

# Minimum thresholds — tuned for the current brightness/contrast/saturate
# filter. If a regression dims or desaturates the logo, the script fails.
MIN_MEAN_SATURATION   = 35   # 0..255 HSV S channel — colored logos must read as color
MIN_GLOW_DELTA        = 4    # mean lightness inside the aura vs. outside corners

def sample_metrics(png_path: Path) -> dict:
    im = Image.open(png_path).convert("RGB")
    w, h = im.size
    # Center 60% box = logo + aura region
    cx0, cy0, cx1, cy1 = int(w*0.2), int(h*0.2), int(w*0.8), int(h*0.8)
    center = im.crop((cx0, cy0, cx1, cy1))
    hsv = center.convert("HSV")
    sat = [p[1] for p in hsv.getdata()]
    mean_sat = sum(sat) / len(sat)

    # Glow delta: lightness of central aura ring vs the outer corners
    def mean_L(box):
        crop = im.crop(box).convert("L")
        d = list(crop.getdata())
        return sum(d) / len(d)
    aura_L = mean_L((int(w*0.3), int(h*0.3), int(w*0.7), int(h*0.7)))
    corner_L = (
        mean_L((0,           0,           int(w*0.1), int(h*0.1))) +
        mean_L((int(w*0.9),  0,           w,          int(h*0.1))) +
        mean_L((0,           int(h*0.9),  int(w*0.1), h         )) +
        mean_L((int(w*0.9),  int(h*0.9),  w,          h         ))
    ) / 4
    return {
        "mean_saturation": round(mean_sat, 2),
        "glow_delta":       round(abs(aura_L - corner_L), 2),
    }

async def main():
    failures = []
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for theme in THEMES:
            for name, w, h in VIEWPORTS:
                ctx = await browser.new_context(viewport={"width": w, "height": h})
                page = await ctx.new_page()
                await page.goto("http://localhost:8080/", wait_until="networkidle")
                await page.evaluate(f"""
                  document.documentElement.classList.remove('light','dark');
                  document.documentElement.classList.add('{theme}');
                """)
                await page.wait_for_timeout(400)
                ident = page.locator("[data-testid=hero-studio-ident]:visible").first
                await ident.wait_for(state="visible", timeout=5000)
                box = await ident.bounding_box()
                img = ident.locator("img").first
                ibox = await img.bounding_box()
                cropped = (
                    ibox is None or box is None or
                    ibox["x"] + ibox["width"] > box["x"] + box["width"] + 0.5 or
                    ibox["y"] + ibox["height"] > box["y"] + box["height"] + 0.5
                )
                centered = bool(ibox and box and abs(
                    (ibox["x"] + ibox["width"]/2) - (box["x"] + box["width"]/2)) < 2)
                shot = OUT / f"{theme}_{name}.png"
                await ident.screenshot(path=str(shot))
                m = sample_metrics(shot)
                row = {"theme": theme, "viewport": name,
                       "cropped": cropped, "centered": centered, **m}
                results.append(row)
                if cropped:                                     failures.append(f"{row} (cropped)")
                if not centered:                                failures.append(f"{row} (not centered)")
                if m["mean_saturation"] < MIN_MEAN_SATURATION:  failures.append(f"{row} (dim/desaturated)")
                if m["glow_delta"]      < MIN_GLOW_DELTA:       failures.append(f"{row} (aura missing)")
                await ctx.close()
        await browser.close()
    print(json.dumps(results, indent=2))
    if failures:
        print("\nFAILURES:")
        for f in failures: print("  -", f)
        sys.exit(1)
    print("\nALL PASS")

asyncio.run(main())
