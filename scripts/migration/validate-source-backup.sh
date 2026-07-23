#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <backup-file> <expected-sha256> <private-output-directory>" >&2
  exit 2
}

[[ $# -eq 3 ]] || usage
backup_file=$1
expected_sha=$2
output_dir=$3

[[ -f "$backup_file" ]] || { echo "Backup not found" >&2; exit 1; }
[[ "$expected_sha" =~ ^[0-9a-fA-F]{64}$ ]] || { echo "Expected SHA-256 is invalid" >&2; exit 1; }
command -v pg_restore >/dev/null || { echo "PostgreSQL 18 pg_restore is required" >&2; exit 1; }
command -v shasum >/dev/null || { echo "shasum is required" >&2; exit 1; }

pg_restore_version=$(pg_restore --version)
case "$pg_restore_version" in
  *" 18."*) ;;
  *) echo "Refusing: use PostgreSQL 18 pg_restore for this archive ($pg_restore_version)" >&2; exit 1 ;;
esac

actual_sha=$(shasum -a 256 "$backup_file" | awk '{print $1}')
[[ "${actual_sha,,}" == "${expected_sha,,}" ]] || {
  echo "Checksum mismatch; refusing to inspect" >&2
  exit 1
}

mkdir -p "$output_dir"
chmod 700 "$output_dir"
toc_file="$output_dir/source-backup.toc"
metadata_file="$output_dir/source-backup-metadata.txt"

pg_restore --list "$backup_file" > "$toc_file"
chmod 600 "$toc_file"
{
  echo "sha256=$actual_sha"
  echo "size_bytes=$(stat -f %z "$backup_file" 2>/dev/null || stat -c %s "$backup_file")"
  echo "pg_restore=$pg_restore_version"
  echo "toc_entries=$(grep -Ec '^[0-9]+;' "$toc_file" || true)"
  echo "validated_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$metadata_file"
chmod 600 "$metadata_file"

echo "Validation PASS. Private TOC: $toc_file"
echo "This script did not restore or connect to a database."
