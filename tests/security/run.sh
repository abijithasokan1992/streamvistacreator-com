#!/usr/bin/env bash
# Runs the SECURITY DEFINER privilege & role-gating test suite.
#
# Requires either:
#   - PG* env vars (PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE), or
#   - DATABASE_URL pointing at the target Postgres.
#
# Exits non-zero on any failed assertion. The script runs inside a
# transaction that is rolled back, so the database is never mutated.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/security_definer_privileges.sql"

if [[ -n "${DATABASE_URL:-}" ]]; then
  exec psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -q -f "$SQL_FILE"
elif [[ -n "${PGHOST:-}" ]]; then
  exec psql -v ON_ERROR_STOP=1 -X -q -f "$SQL_FILE"
else
  echo "error: set DATABASE_URL or PG* env vars before running" >&2
  exit 2
fi
