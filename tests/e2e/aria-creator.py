"""
E2E test: signs in as a creator, opens the Creator dashboard, sends an Aria
message, and verifies that the `agent-chat` Edge Function is invoked and
returns a valid AI response.

Run from the repo root:

    python3 tests/e2e/aria-creator.py

Required environment variables (one of the two auth strategies):

  Strategy A — pre-minted session (preferred, mirrors Lovable's pattern):
    TEST_CREATOR_SESSION_JSON   Full Supabase session JSON
                                (access_token, refresh_token, user, expires_at, …)

  Strategy B — email + password (only works if the creator user has a
  password set; the StreamVista UI itself is magic-link only):
    TEST_CREATOR_EMAIL
    TEST_CREATOR_PASSWORD

Optional:
    BASE_URL                    Defaults to http://localhost:8080
    SUPABASE_URL                Defaults to the project URL baked into the client
    SUPABASE_ANON_KEY           Defaults to the project anon key baked into the client
    ARIA_PROMPT                 Defaults to "ping — say hello in one short sentence"

Exit code 0 = PASS, 1 = FAIL. Screenshots are written to tests/e2e/screenshots/.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright, Request, Response

ROOT = Path(__file__).parent
SHOTS = ROOT / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080").rstrip("/")
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://hllgmkfqgeuqlmpcirvn.supabase.co"
).rstrip("/")
SUPABASE_ANON_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    # Publishable anon key — safe to ship in client code.
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsbGdta2ZxZ2V1cWxtcGNpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjQ1MTcsImV4cCI6MjA5NDY0MDUxN30."
    "0X_qVm8wGWLxQ9hPx7wdAbmzYIsC5FFH8taYY1aevSs",
)
ARIA_PROMPT = os.environ.get(
    "ARIA_PROMPT", "ping — reply with one short sentence so we can confirm you are alive"
)

PROJECT_REF = SUPABASE_URL.split("//", 1)[-1].split(".", 1)[0]
STORAGE_KEY = f"sb-{PROJECT_REF}-auth-token"


def fail(msg: str) -> "None":
    print(f"\n❌ FAIL — {msg}")
    sys.exit(1)


def ok(msg: str) -> None:
    print(f"✅ {msg}")


async def mint_session_via_password() -> dict:
    """Strategy B: sign in with email + password via the Supabase Auth REST API."""
    import urllib.request

    email = os.environ.get("TEST_CREATOR_EMAIL")
    password = os.environ.get("TEST_CREATOR_PASSWORD")
    if not (email and password):
        return {}

    body = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        data=body,
        method="POST",
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            payload = json.loads(resp.read().decode())
    except Exception as e:  # noqa: BLE001
        fail(f"password sign-in failed: {e}")

    if "access_token" not in payload:
        fail(f"password sign-in returned no access_token: {payload}")
    return payload


async def resolve_session() -> dict:
    raw = os.environ.get("TEST_CREATOR_SESSION_JSON")
    if raw:
        try:
            session = json.loads(raw)
        except json.JSONDecodeError as e:
            fail(f"TEST_CREATOR_SESSION_JSON is not valid JSON: {e}")
        if "access_token" not in session:
            fail("TEST_CREATOR_SESSION_JSON missing access_token")
        return session

    session = await mint_session_via_password()
    if not session:
        fail(
            "No creator credentials available. Set TEST_CREATOR_SESSION_JSON "
            "or TEST_CREATOR_EMAIL + TEST_CREATOR_PASSWORD."
        )
    return session


async def main() -> None:
    print(f"BASE_URL       = {BASE_URL}")
    print(f"SUPABASE_URL   = {SUPABASE_URL}")
    print(f"STORAGE_KEY    = {STORAGE_KEY}")

    session = await resolve_session()
    user = session.get("user") or {}
    print(f"Signed in as   = {user.get('email') or user.get('id') or '<unknown>'}")

    # Track every agent-chat request and its response.
    agent_requests: list[Request] = []
    agent_responses: list[Response] = []

    def on_request(req: Request) -> None:
        if "/functions/v1/agent-chat" in req.url:
            agent_requests.append(req)

    def on_response(res: Response) -> None:
        if "/functions/v1/agent-chat" in res.url:
            agent_responses.append(res)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        page.on("request", on_request)
        page.on("response", on_response)
        page.on("pageerror", lambda e: print(f"[pageerror] {e}"))

        # 1. Establish origin, inject session, then load the dashboard.
        await page.goto(BASE_URL + "/", wait_until="domcontentloaded")
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(STORAGE_KEY)}, "
            f"{json.dumps(json.dumps(session))})"
        )
        await page.goto(BASE_URL + "/dashboard/content", wait_until="domcontentloaded")
        await page.wait_for_timeout(3500)
        await page.screenshot(path=str(SHOTS / "1_dashboard.png"))

        if page.url.rstrip("/").endswith("/auth"):
            fail("session was rejected — app redirected to /auth")
        ok(f"dashboard loaded at {page.url}")

        # 2. Open the Aria dock.
        launcher = page.get_by_role("button", name="Open AI assistant")
        try:
            await launcher.wait_for(state="visible", timeout=8000)
        except Exception:
            await page.screenshot(path=str(SHOTS / "2_no_dock.png"))
            fail("Aria dock launcher not visible on /dashboard/content")
        await launcher.click()
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(SHOTS / "2_dock_open.png"))
        ok("Aria dock opened")

        # 3. Send a message.
        input_box = page.locator('input[placeholder^="Ask"]').first
        await input_box.wait_for(state="visible", timeout=5000)
        await input_box.fill(ARIA_PROMPT)
        await input_box.press("Enter")
        ok(f"sent prompt: {ARIA_PROMPT!r}")

        # 4. Wait for the agent-chat response.
        deadline = time.time() + 45
        matched: Response | None = None
        while time.time() < deadline:
            for res in agent_responses:
                if res.request.method == "POST":
                    matched = res
                    break
            if matched:
                break
            await page.wait_for_timeout(500)

        await page.screenshot(path=str(SHOTS / "3_after_send.png"))

        if not agent_requests:
            fail("no request was made to /functions/v1/agent-chat")
        ok(f"agent-chat was invoked ({len(agent_requests)} request(s))")

        if not matched:
            fail("no response received from agent-chat within 45s")

        status = matched.status
        try:
            body_text = await matched.text()
        except Exception as e:  # noqa: BLE001
            fail(f"could not read agent-chat response body: {e}")

        if status < 200 or status >= 300:
            fail(f"agent-chat returned non-2xx status={status} body={body_text[:400]}")
        ok(f"agent-chat returned HTTP {status}")

        try:
            payload = json.loads(body_text)
        except json.JSONDecodeError:
            fail(f"agent-chat response is not JSON: {body_text[:400]}")

        content = (payload or {}).get("content")
        if not isinstance(content, str) or not content.strip():
            fail(f"agent-chat response has no `content` string: {payload}")
        ok(f"AI response received ({len(content)} chars): {content[:160]!r}")

        # 5. Confirm the assistant bubble rendered in the UI.
        await page.wait_for_timeout(800)
        snippet = content.strip().split("\n", 1)[0][:40]
        try:
            await page.get_by_text(snippet, exact=False).first.wait_for(timeout=4000)
            ok("assistant reply rendered in the dock")
        except Exception:
            print(f"⚠️  could not find assistant bubble text {snippet!r} in DOM "
                  f"(network response was valid; UI render check is soft)")

        await page.screenshot(path=str(SHOTS / "4_reply_rendered.png"))
        await browser.close()

    print("\n🎉 PASS — Aria end-to-end flow is healthy.")


if __name__ == "__main__":
    asyncio.run(main())
