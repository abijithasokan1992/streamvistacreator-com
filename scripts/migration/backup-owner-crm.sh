#!/usr/bin/env bash
set -euo pipefail

project_ref="ohumdxxhtgabpefrgsxr"

usage() {
  echo "Usage: $0 <database-host> <port> <database-user> <private-output-directory>" >&2
  echo "Copy host, port and user from Supabase Connect > Direct or Session pooler. Never paste the password into chat or Git." >&2
  exit 2
}

[[ $# -eq 4 ]] || usage
db_host=$1
db_port=$2
db_user=$3
output_dir=$4

[[ "$db_port" =~ ^[0-9]+$ ]] || { echo "Invalid port" >&2; exit 1; }
if [[ "$db_host $db_user" != *"$project_ref"* ]]; then
  echo "Refusing: connection identity does not contain expected project ref $project_ref" >&2
  exit 1
fi

command -v pg_dump >/dev/null || { echo "PostgreSQL 18 pg_dump is required" >&2; exit 1; }
command -v shasum >/dev/null || { echo "shasum is required" >&2; exit 1; }
pg_dump_version=$(pg_dump --version)
case "$pg_dump_version" in
  *" 18."*) ;;
  *) echo "Refusing: install PostgreSQL 18 client ($pg_dump_version found)" >&2; exit 1 ;;
esac

mkdir -p "$output_dir"
chmod 700 "$output_dir"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$output_dir/streamvista-crm_${timestamp}.backup"
metadata_file="$output_dir/streamvista-crm_${timestamp}.metadata.txt"

printf "Database password (input is hidden): " >&2
IFS= read -r -s db_password
printf "\n" >&2
[[ -n "$db_password" ]] || { echo "Password is required" >&2; exit 1; }

export PGPASSWORD="$db_password"
trap 'unset PGPASSWORD db_password' EXIT

pg_dump \
  --host="$db_host" \
  --port="$db_port" \
  --username="$db_user" \
  --dbname=postgres \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$backup_file"

chmod 600 "$backup_file"
backup_sha=$(shasum -a 256 "$backup_file" | awk '{print $1}')
backup_size=$(stat -f %z "$backup_file" 2>/dev/null || stat -c %s "$backup_file")
{
  echo "project_ref=$project_ref"
  echo "created_utc=$timestamp"
  echo "sha256=$backup_sha"
  echo "size_bytes=$backup_size"
  echo "pg_dump=$pg_dump_version"
  echo "format=custom"
  echo "owner_acl_excluded=true"
} > "$metadata_file"
chmod 600 "$metadata_file"

unset PGPASSWORD db_password
trap - EXIT

echo "CRM backup checkpoint created: $backup_file"
echo "SHA-256: $backup_sha"
echo "Metadata: $metadata_file"
echo "Keep both files private. Do not commit or upload them to GitHub."
