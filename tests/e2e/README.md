# Aria Creator E2E test

End-to-end check that:

1. Restores a creator session into the running app.
2. Loads `/dashboard/content`.
3. Opens the Aria dock and sends a prompt.
4. Confirms `POST /functions/v1/agent-chat` returns HTTP 2xx with a non-empty
   `content` string, and that the reply renders in the dock.

## Run

```bash
python3 tests/e2e/aria-creator.py
```

## Authentication

The StreamVista UI is magic-link only, so the test does not drive the sign-in
form. Provide a session via **one** of:

- **Strategy A (preferred)** — paste a full Supabase session JSON:
  ```bash
  export TEST_CREATOR_SESSION_JSON='{"access_token":"…","refresh_token":"…","user":{…},"expires_at":…}'
  ```
  Easiest way to capture one: sign in to the preview as a creator, open
  DevTools → Application → Local Storage, copy the value of
  `sb-<project-ref>-auth-token`.

- **Strategy B** — email + password (only works if the creator user has a
  password set in auth.users):
  ```bash
  export TEST_CREATOR_EMAIL=creator@example.com
  export TEST_CREATOR_PASSWORD='…'
  ```

## Optional env

| Var | Default |
|---|---|
| `BASE_URL` | `http://localhost:8080` |
| `SUPABASE_URL` | project URL baked into the client |
| `SUPABASE_ANON_KEY` | project anon key baked into the client |
| `ARIA_PROMPT` | `"ping — reply with one short sentence so we can confirm you are alive"` |

## Output

- Exit code `0` on PASS, `1` on FAIL.
- Step-by-step screenshots in `tests/e2e/screenshots/`.
